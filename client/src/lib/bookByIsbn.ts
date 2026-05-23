import axios from 'axios';
import { api } from '@/lib/api';

export type ResolvedBook = {
  id: string;
  isbn: string;
  title: string;
  author: string | null;
  year?: number | null;
  genre?: string | null;
  publisher?: string | null;
  description?: string | null;
  coverPath?: string | null;
};

export type BookResolveProvider = 'cache' | 'db' | 'google' | 'openlibrary' | 'wikidata';

/** Normalizza ISBN per cache e richieste (solo cifre, 10/13). */
export function normalizeIsbnDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

const sessionCache = new Map<string, ResolvedBook>();

/** Libro già risolto in questa sessione (istantaneo). */
export function getCachedBook(isbn: string): ResolvedBook | null {
  const key = normalizeIsbnDigits(isbn);
  return key ? sessionCache.get(key) ?? null : null;
}

export function primeBookCache(book: ResolvedBook): void {
  const key = normalizeIsbnDigits(book.isbn);
  if (key) sessionCache.set(key, book);
}

/**
 * Risolve un ISBN: cache sessione → solo DB (`fetch=db`) → catalogo completo.
 * Evita Google/Open Library se il libro è già in database.
 */
export async function resolveBookByIsbn(
  rawIsbn: string,
): Promise<{ book: ResolvedBook; provider: BookResolveProvider }> {
  const key = normalizeIsbnDigits(rawIsbn);
  if (!key) throw new Error('ISBN non valido');

  const cached = sessionCache.get(key);
  if (cached) return { book: cached, provider: 'cache' };

  try {
    const { data } = await api.get<{ book: ResolvedBook }>(`/books/isbn/${encodeURIComponent(key)}`, {
      params: { fetch: 'db' },
    });
    const book = { ...data.book, isbn: data.book.isbn || key };
    sessionCache.set(key, book);
    return { book, provider: 'db' };
  } catch (err) {
    if (!axios.isAxiosError(err) || err.response?.status !== 404) {
      throw err;
    }
  }

  const { data } = await api.get<{
    book: ResolvedBook;
    provider?: BookResolveProvider;
  }>(`/books/isbn/${encodeURIComponent(key)}`, {
    timeout: 60_000,
  });

  const book = { ...data.book, isbn: data.book.isbn || key };
  sessionCache.set(key, book);
  return { book, provider: data.provider ?? 'google' };
}
