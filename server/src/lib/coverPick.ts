import { createHash } from 'node:crypto';

const INVALID_COVER_PATTERNS = [
  /1x1/i,
  /no[-_]?cover/i,
  /placeholder/i,
  /avatar_book/i,
  /image\/not[-_]?available/i,
  /spacer\.gif/i,
];

/** PNG "image not available" di Google Books (zoom=0): sempre 575×750, ~9KB. */
const GOOGLE_PLACEHOLDER_MD5 = 'a64fa89d7ebc97075c1d363fc5fea71f';

const MIN_COVER_BYTES = 2_500;
const MIN_COVER_WIDTH = 120;
const MIN_COVER_HEIGHT = 150;

/** Copertina Open Library da ISBN (fallback). */
export function openLibraryCoverByIsbn(isbn: string): string {
  return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
}

/** URL copertina plausibile (esclude placeholder noti nell'URL; non verifica il file). */
export function isValidCoverUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  const u = url.trim();
  if (!/^https?:\/\//i.test(u)) return false;
  if (INVALID_COVER_PATTERNS.some((re) => re.test(u))) return false;
  if (/books\.google\.com\/books\/content/i.test(u) && /zoom=0\b/i.test(u)) return false;
  return true;
}

function readImageDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  let i = 0;
  while (i < buf.length - 9) {
    if (buf[i] === 0xff && buf[i + 1] === 0xc0) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 1;
  }
  return null;
}

function isGooglePlaceholderImage(buf: Buffer): boolean {
  if (buf.length < 8_000 || buf.length > 10_500) return false;
  const dim = readImageDimensions(buf);
  if (dim?.width === 575 && dim?.height === 750) {
    const md5 = createHash('md5').update(buf).digest('hex');
    if (md5 === GOOGLE_PLACEHOLDER_MD5) return true;
  }
  return false;
}

function isUsableCoverBuffer(buf: Buffer): boolean {
  if (buf.length < MIN_COVER_BYTES) return false;
  if (isGooglePlaceholderImage(buf)) return false;
  const dim = readImageDimensions(buf);
  if (dim && (dim.width < MIN_COVER_WIDTH || dim.height < MIN_COVER_HEIGHT)) return false;
  return true;
}

/**
 * Scarica i primi KB dell'immagine e verifica che non sia placeholder / 1×1.
 * Google non scrive "image not available" nell'API: restituisce comunque un URL
 * che punta a un PNG con quella scritta (~9KB a zoom=0, ~1.2KB a zoom=1 se manca).
 */
export async function probeCoverUrl(url: string): Promise<boolean> {
  if (!isValidCoverUrl(url)) return false;
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: 'image/*' },
    });
    if (!res.ok) return false;
    const ct = res.headers.get('content-type') ?? '';
    if (ct && !ct.includes('image')) return false;

    const buf = Buffer.from(await res.arrayBuffer());
    return isUsableCoverBuffer(buf);
  } catch {
    return false;
  }
}

export async function normalizeCoverUrl(url: string | null | undefined): Promise<string | null> {
  const u = url?.trim();
  if (!u || !isValidCoverUrl(u)) return null;
  if (await probeCoverUrl(u)) return u;
  return null;
}

/**
 * Copertina: Google Books prima, poi Open Library, infine fallback ISBN (solo se valido).
 */
export function pickCoverUrlSync(
  googleUrl: string | null | undefined,
  openLibraryUrl: string | null | undefined,
  isbn: string,
): string | null {
  if (isValidCoverUrl(googleUrl)) return googleUrl!.trim();
  if (isValidCoverUrl(openLibraryUrl)) return openLibraryUrl!.trim();
  const fallback = openLibraryCoverByIsbn(isbn);
  if (isValidCoverUrl(fallback)) return fallback;
  return null;
}

export async function pickCoverUrl(
  googleUrl: string | null | undefined,
  openLibraryUrl: string | null | undefined,
  isbn: string,
): Promise<string | null> {
  if (isValidCoverUrl(googleUrl) && (await probeCoverUrl(googleUrl!))) return googleUrl!.trim();
  if (isValidCoverUrl(openLibraryUrl) && (await probeCoverUrl(openLibraryUrl!))) {
    return openLibraryUrl!.trim();
  }
  const fallback = openLibraryCoverByIsbn(isbn);
  if (await normalizeCoverUrl(fallback)) return fallback;
  return null;
}

/** @deprecated Usare isValidCoverUrl / pickCoverUrl */
export function coverReliabilityScore(url: string | null | undefined): number {
  if (!isValidCoverUrl(url)) return 0;
  const u = url!.trim();
  if (/books\.google\.com\/books\/content/i.test(u)) return 100;
  if (/googleusercontent\.com/i.test(u)) return 90;
  if (/covers\.openlibrary\.org\/b\/id\//i.test(u)) return 70;
  if (/covers\.openlibrary\.org/i.test(u)) return 50;
  return 40;
}

export function pickBestCoverUrl(
  ...urls: Array<string | null | undefined>
): string | null {
  for (const raw of urls) {
    if (isValidCoverUrl(raw)) return raw!.trim();
  }
  return null;
}
