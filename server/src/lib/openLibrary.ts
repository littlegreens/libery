import { isbnsEquivalent } from './bookMetadataQuality.js';
import type { GoogleBookPayload } from './googleBooks.js';
import { normalizeIsbn } from './isbn.js';

const USER_AGENT = 'Libery/1.0 (https://libery.app; book metadata)';

type OpenLibraryEntry = {
  key?: string;
  title?: string;
  subtitle?: string;
  authors?: Array<{ name?: string }>;
  publishers?: Array<{ name?: string }>;
  publish_date?: string;
  number_of_pages?: number;
  subjects?: Array<{ name?: string } | string>;
  languages?: Array<{ key?: string }>;
  cover?: { medium?: string; large?: string; small?: string };
  notes?: string;
};

type OpenLibrarySearchDoc = {
  title?: string;
  author_name?: string[];
  publisher?: string[];
  first_publish_year?: number;
  number_of_pages_median?: number;
  subject?: string[];
  cover_i?: number;
  language?: string[];
  isbn?: string[];
};

function searchDocMatchesIsbn(doc: OpenLibrarySearchDoc, isbn: string): boolean {
  const list = doc.isbn ?? [];
  if (list.length === 0) return false;
  for (const raw of list) {
    if (isbnsEquivalent(String(raw), isbn)) return true;
  }
  return false;
}

function mapEntry(entry: OpenLibraryEntry, isbn: string): GoogleBookPayload | null {
  if (!entry.title) return null;

  const year = entry.publish_date ? parseInt(entry.publish_date.slice(0, 4), 10) : null;
  const genre =
    typeof entry.subjects?.[0] === 'string'
      ? entry.subjects[0]
      : (entry.subjects?.[0] as { name?: string } | undefined)?.name ?? null;

  const title = entry.subtitle ? `${entry.title}: ${entry.subtitle}` : entry.title;

  return {
    isbn,
    title,
    author: entry.authors?.map((a) => a.name).filter(Boolean).join(', ') || null,
    publisher: entry.publishers?.[0]?.name ?? null,
    year: Number.isFinite(year!) ? year : null,
    edition: null,
    description: typeof entry.notes === 'string' ? entry.notes.slice(0, 4000) : null,
    language: entry.languages?.[0]?.key?.replace(/^\/languages\//, '') ?? null,
    pages: entry.number_of_pages ?? null,
    genre,
    coverUrl: entry.cover?.large ?? entry.cover?.medium ?? entry.cover?.small ?? null,
  };
}

async function fetchWorkDescription(bookKey: string): Promise<string | null> {
  const editionUrl = `https://openlibrary.org${bookKey}.json`;
  const editionRes = await fetch(editionUrl, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(10_000),
  });
  if (!editionRes.ok) return null;

  const edition = (await editionRes.json()) as {
    works?: Array<{ key?: string }>;
    description?: string | { value?: string };
  };

  let inline: string | null = null;
  const rawDesc = edition.description;
  if (typeof rawDesc === 'string') inline = rawDesc;
  else if (rawDesc && typeof rawDesc === 'object' && rawDesc.value) inline = String(rawDesc.value);

  const workKey = edition.works?.[0]?.key;
  if (!workKey) return inline?.slice(0, 4000) ?? null;

  const workRes = await fetch(`https://openlibrary.org${workKey}.json`, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(10_000),
  });
  if (!workRes.ok) return inline?.slice(0, 4000) ?? null;

  const work = (await workRes.json()) as { description?: string | { value?: string } };
  const rawWork = work.description;
  let workDesc: string | null = null;
  if (typeof rawWork === 'string') workDesc = rawWork;
  else if (rawWork && typeof rawWork === 'object' && rawWork.value) workDesc = String(rawWork.value);

  const chosen = workDesc && (!inline || workDesc.length >= inline.length) ? workDesc : inline;
  return chosen?.slice(0, 4000) ?? null;
}

function mapSearchDoc(doc: OpenLibrarySearchDoc, isbn: string): GoogleBookPayload | null {
  if (!doc.title) return null;
  const coverUrl = doc.cover_i
    ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
    : null;

  return {
    isbn,
    title: doc.title,
    author: doc.author_name?.length ? doc.author_name.join(', ') : null,
    publisher: doc.publisher?.[0] ?? null,
    year: doc.first_publish_year ?? null,
    edition: null,
    description: null,
    language: doc.language?.[0] ?? null,
    pages: doc.number_of_pages_median ?? null,
    genre: doc.subject?.[0] ?? null,
    coverUrl,
  };
}

async function fetchFromDataApi(isbn: string): Promise<GoogleBookPayload | null> {
  const url = `https://openlibrary.org/api/books?bibkeys=${encodeURIComponent(`ISBN:${isbn}`)}&format=json&jscmd=data`;

  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as Record<string, OpenLibraryEntry | undefined>;
  const entry = data[`ISBN:${isbn}`];
  if (!entry) return null;

  const mapped = mapEntry(entry, isbn);
  if (!mapped) return null;

  if (!mapped.description && entry.key) {
    try {
      mapped.description = await fetchWorkDescription(entry.key);
    } catch {
      /* trama opzionale */
    }
  }

  return mapped;
}

async function fetchFromSearchApi(isbn: string): Promise<GoogleBookPayload | null> {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(`isbn:${isbn}`)}&limit=1`;

  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as { docs?: OpenLibrarySearchDoc[] };
  const doc = data.docs?.[0];
  if (!doc || !searchDocMatchesIsbn(doc, isbn)) return null;
  return mapSearchDoc(doc, isbn);
}

export async function fetchBookFromOpenLibrary(rawIsbn: string): Promise<GoogleBookPayload | null> {
  const isbn = normalizeIsbn(rawIsbn);
  if (!isbn) return null;

  return (await fetchFromDataApi(isbn)) ?? (await fetchFromSearchApi(isbn));
}
