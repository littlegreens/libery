import type { Book } from '@prisma/client';
import { isValidCoverUrl } from './coverPick.js';

function isWeakTitle(title: string): boolean {
  return /^ISBN\s*\d{10,13}$/i.test(title.trim());
}

/**
 * True se manca qualcosa di essenziale (titolo, autore, copertina, trama).
 * Se false → solo DB, zero chiamate Google/Open Library (risparmio quota).
 */
export function bookNeedsExternalEnrichment(book: Book): boolean {
  if (isWeakTitle(book.title)) return true;
  if (!book.author?.trim()) return true;
  if (!isValidCoverUrl(book.coverPath)) return true;
  if (!book.description?.trim()) return true;
  return false;
}

/** Copertine da verificare con download (OL, Google zoom=0 o placeholder noto). */
export function coverNeedsProbe(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  if (!isValidCoverUrl(url)) return true;
  const u = url.trim();
  if (/covers\.openlibrary\.org/i.test(u)) return true;
  if (/books\.google\.com\/books\/content/i.test(u) && /zoom=0\b/i.test(u)) return true;
  return false;
}
