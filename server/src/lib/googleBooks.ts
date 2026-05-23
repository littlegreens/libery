import { isbnsEquivalent } from './bookMetadataQuality.js';
import { htmlToPlainText } from './htmlText.js';
import { normalizeIsbn } from './isbn.js';

export type GoogleBookPayload = {
  isbn: string;
  title: string;
  author: string | null;
  publisher: string | null;
  year: number | null;
  edition: string | null;
  description: string | null;
  language: string | null;
  pages: number | null;
  genre: string | null;
  coverUrl: string | null;
};

type GoogleVolume = {
  id?: string;
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    pageCount?: number;
    categories?: string[];
    language?: string;
    imageLinks?: Record<string, string | undefined>;
    industryIdentifiers?: Array<{ type?: string; identifier?: string }>;
  };
};

type GoogleResponse = {
  totalItems?: number;
  items?: GoogleVolume[];
};

/** Il volume Google deve riportare lo stesso ISBN richiesto (no “primo risultato” a caso). */
function volumeIndustryIsbnMatches(volume: GoogleVolume, requestedIsbn: string): boolean {
  const req = normalizeIsbn(requestedIsbn);
  if (!req) return false;
  const ids = volume.volumeInfo?.industryIdentifiers ?? [];
  for (const id of ids) {
    if (!id.identifier?.trim()) continue;
    if (isbnsEquivalent(id.identifier, req)) return true;
  }
  return false;
}

function parseYear(publishedDate?: string): number | null {
  if (!publishedDate) return null;
  const y = parseInt(publishedDate.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

/**
 * Copertina da imageLinks così come fornite dall'API.
 * Non usare zoom=0: spesso restituisce il PNG generico "image not available"
 * (575×750 ~9KB) anche quando zoom=1 ha la copertina vera.
 */
function pickCover(links?: Record<string, string | undefined>): string | null {
  if (!links) return null;
  const url =
    links.extraLarge ??
    links.large ??
    links.medium ??
    links.thumbnail ??
    links.smallThumbnail;
  if (!url) return null;
  return url.replace(/^http:/, 'https:').replace(/&edge=curl/g, '');
}

function mapVolume(volume: GoogleVolume, fallbackIsbn: string): GoogleBookPayload | null {
  const info = volume.volumeInfo;
  if (!info?.title) return null;

  const ids = info.industryIdentifiers ?? [];
  const isbn13 =
    ids.find((i) => i.type === 'ISBN_13')?.identifier ??
    ids.find((i) => i.identifier && i.identifier.length === 13)?.identifier;
  const isbn10 = ids.find((i) => i.type === 'ISBN_10')?.identifier;
  const isbn =
    (isbn13 ? normalizeIsbn(isbn13) : null) ??
    (isbn10 ? normalizeIsbn(isbn10) : null) ??
    fallbackIsbn;

  const title = info.subtitle ? `${info.title}: ${info.subtitle}` : info.title;

  return {
    isbn,
    title,
    author: info.authors?.length ? info.authors.join(', ') : null,
    publisher: info.publisher ?? null,
    year: parseYear(info.publishedDate),
    edition: null,
    description: info.description
      ? htmlToPlainText(info.description).slice(0, 4000) || null
      : null,
    language: info.language ?? null,
    pages: info.pageCount ?? null,
    genre: info.categories?.[0] ?? null,
    coverUrl: pickCover(info.imageLinks),
  };
}

export async function fetchBookFromGoogleBooks(rawIsbn: string): Promise<GoogleBookPayload | null> {
  const isbn = normalizeIsbn(rawIsbn);
  if (!isbn) return null;

  const apiKey = process.env.GOOGLE_BOOKS_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(`isbn:${isbn}`)}&maxResults=1&key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 429) {
      console.error('Google Books: quota esaurita.');
    } else {
      console.error(`Google Books API ${res.status}: ${body.slice(0, 200)}`);
    }
    return null;
  }

  const data = (await res.json()) as GoogleResponse;
  if (!data.items?.length) return null;

  for (const hit of data.items) {
    if (!volumeIndustryIsbnMatches(hit, isbn)) {
      continue;
    }

    // La ricerca per ISBN spesso omette `description`; il GET sul volume la include.
    let volume: GoogleVolume = hit;
    if (hit.id) {
      try {
        const detailUrl = `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(hit.id)}?key=${encodeURIComponent(apiKey)}`;
        const detailRes = await fetch(detailUrl, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(12_000),
        });
        if (detailRes.ok) {
          const detailed = (await detailRes.json()) as GoogleVolume;
          if (volumeIndustryIsbnMatches(detailed, isbn)) {
            volume = detailed;
          }
        }
      } catch {
        /* usa risultato ricerca */
      }
    }

    const mapped = mapVolume(volume, isbn);
    if (!mapped) continue;
    if (!mapped.coverUrl) {
      console.warn(`[isbn:${isbn}] Google Books: volume senza imageLinks`);
    }
    return mapped;
  }

  console.warn(`[isbn:${isbn}] Google Books: nessun volume con ISBN corrispondente`);
  return null;
}
