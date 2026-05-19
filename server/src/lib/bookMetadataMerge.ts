import type { GoogleBookPayload } from './googleBooks.js';
import { isValidCoverUrl, openLibraryCoverByIsbn, pickCoverUrlSync } from './coverPick.js';

export { openLibraryCoverByIsbn } from './coverPick.js';

function langKey(code: string | null | undefined): string | null {
  if (!code?.trim()) return null;
  return code.trim().toLowerCase().replace(/^\/languages\//, '').slice(0, 2);
}

/** Preferisce la trama nella lingua del libro (es. `it`), altrimenti la più lunga. */
function pickBestDescription(
  primary: GoogleBookPayload,
  secondary: GoogleBookPayload,
): string | null {
  const a = primary.description?.trim() || null;
  const b = secondary.description?.trim() || null;
  if (!a) return b;
  if (!b) return a;

  const target = langKey(primary.language) ?? langKey(secondary.language);
  if (target) {
    const aLang = langKey(primary.language);
    const bLang = langKey(secondary.language);
    if (aLang === target && bLang !== target) return a;
    if (bLang === target && aLang !== target) return b;
  }

  return b.length > a.length ? b : a;
}

/** Unisce due risultati: il primo ha priorità, il secondo riempie i campi mancanti (es. copertina). */
export function mergeBookMetadata(
  primary: GoogleBookPayload,
  secondary: GoogleBookPayload,
): GoogleBookPayload {
  return {
    isbn: primary.isbn,
    title: primary.title || secondary.title,
    author: primary.author ?? secondary.author,
    publisher: primary.publisher ?? secondary.publisher,
    year: primary.year ?? secondary.year,
    edition: primary.edition ?? secondary.edition,
    description: pickBestDescription(primary, secondary),
    language: primary.language ?? secondary.language,
    pages: primary.pages ?? secondary.pages,
    genre: primary.genre ?? secondary.genre,
    coverUrl: pickCoverUrlSync(primary.coverUrl, secondary.coverUrl, primary.isbn),
  };
}

export function withCoverFallback(
  book: GoogleBookPayload,
  isbn: string,
): GoogleBookPayload {
  if (isValidCoverUrl(book.coverUrl)) return book;
  return { ...book, coverUrl: pickCoverUrlSync(book.coverUrl, null, isbn) };
}
