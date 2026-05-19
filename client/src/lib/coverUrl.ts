/** Priorità copertine (allineata al server). */
export function coverReliabilityScore(url: string | null | undefined): number {
  if (!url?.trim()) return 0;
  const u = url.trim();
  if (/covers\.openlibrary\.org\/b\/id\//i.test(u)) return 100;
  if (/covers\.openlibrary\.org\/b\/isbn\//i.test(u)) return 40;
  if (/covers\.openlibrary\.org/i.test(u)) return 70;
  if (/books\.google\.com\/books\/content/i.test(u) && /zoom=0\b/i.test(u)) return 0;
  if (/books\.google\.com\/books\/content/i.test(u)) return 100;
  return 55;
}

/** URL copertina Open Library da ISBN (ultimo fallback). */
export function openLibraryCoverUrl(isbn: string): string {
  const digits = isbn.replace(/\D/g, '');
  return `https://covers.openlibrary.org/b/isbn/${digits}-L.jpg`;
}

export function resolveCoverUrl(coverPath: string | null | undefined, isbn: string): string | null {
  const path = coverPath?.trim();
  if (path && coverReliabilityScore(path) > 0) return path;
  if (isbn.replace(/\D/g, '').length >= 10) return openLibraryCoverUrl(isbn);
  return null;
}
