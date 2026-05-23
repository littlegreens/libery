import type { Book } from '@prisma/client';
import type { GoogleBookPayload } from './googleBooks.js';
import { isValidCoverUrl } from './coverPick.js';
import { normalizeIsbn } from './isbn.js';

const GENERIC_TITLE = /^(unknown|untitled|senza titolo|n\/a|not available)$/i;

/** Titolo generico o solo ISBN — non è un libro reale in catalogo. */
export function isWeakTitle(title: string): boolean {
  const t = title.trim();
  if (!t || t.length < 2) return true;
  if (GENERIC_TITLE.test(t)) return true;
  if (/^ISBN\s*[\dX-]+$/i.test(t)) return true;
  if (/^\d{10,13}$/.test(t.replace(/[\s-]/g, ''))) return true;
  return false;
}

/** Copertina solo da pattern ISBN Open Library (non prova che il libro esista). */
export function isOpenLibraryIsbnOnlyCover(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  return /covers\.openlibrary\.org\/b\/isbn\//i.test(url.trim());
}

export function isbnsEquivalent(a: string, b: string): boolean {
  const na = normalizeIsbn(a);
  const nb = normalizeIsbn(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const coreA = na.length === 13 ? na.slice(3, 12) : na.slice(0, 9);
  const coreB = nb.length === 13 ? nb.slice(3, 12) : nb.slice(0, 9);
  return coreA === coreB;
}

export function payloadIsbnMatchesRequest(payload: GoogleBookPayload, requestedIsbn: string): boolean {
  return isbnsEquivalent(payload.isbn, requestedIsbn);
}

/**
 * Metadati sufficienti per creare un record in catalogo.
 * Rigido: titolo reale, autore, ISBN verificato, copertina da fonte (non solo fallback ISBN).
 */
export function isAcceptableCatalogMetadata(
  payload: GoogleBookPayload,
  requestedIsbn: string,
): boolean {
  if (!payloadIsbnMatchesRequest(payload, requestedIsbn)) return false;
  if (isWeakTitle(payload.title)) return false;
  if (!payload.author?.trim()) return false;

  const cover = payload.coverUrl?.trim() ?? null;
  if (!cover || !isValidCoverUrl(cover) || isOpenLibraryIsbnOnlyCover(cover)) {
    return false;
  }

  return true;
}

/** Copertina da salvare in DB alla creazione (mai inventata da solo ISBN). */
/** Record già in DB ma non affidabile (creato con regole vecchie o dati spuri). */
export function isTrustedDbBook(book: Pick<Book, 'title' | 'author'>): boolean {
  if (isWeakTitle(book.title)) return false;
  if (!book.author?.trim()) return false;
  return true;
}

export function coverPathForCatalogCreate(payload: GoogleBookPayload): string | null {
  const cover = payload.coverUrl?.trim() ?? null;
  if (!cover || !isValidCoverUrl(cover) || isOpenLibraryIsbnOnlyCover(cover)) {
    return null;
  }
  return cover;
}
