import type { Book } from '@prisma/client';
import type { GoogleBookPayload } from './googleBooks.js';
import { isValidCoverUrl, pickCoverUrlSync } from './coverPick.js';
import { metadataScore, snapshotFromDb, snapshotFromPayload, type FieldSnapshot } from './bookResolveLog.js';

function isWeakTitle(title: string): boolean {
  return /^ISBN\s*\d{10,13}$/i.test(title.trim());
}

function pickString(db: string | null, ext: string | null | undefined, mode: 'prefer_ext_if_db_empty' | 'prefer_longer'): string | null {
  const a = db?.trim() || null;
  const b = ext?.trim() || null;
  if (mode === 'prefer_ext_if_db_empty') {
    if (!a) return b;
    if (!b) return a;
    if (isWeakTitle(a) && b) return b;
    return a;
  }
  if (!a) return b;
  if (!b) return a;
  return b.length > a.length ? b : a;
}

function pickNumber(db: number | null, ext: number | null | undefined): number | null {
  return db ?? ext ?? null;
}

export type MergePlan = {
  data: Partial<Book>;
  updatedFields: string[];
  mergedSnapshot: FieldSnapshot;
};

/**
 * Per ogni campo, tiene il valore “migliore” tra DB e fonte esterna (dopo merge delle API).
 */
export function planDbUpdateFromExternal(
  existing: Book,
  external: GoogleBookPayload,
  provider: string,
): MergePlan {
  const isbn = existing.isbn;
  const extCover = pickCoverUrlSync(external.coverUrl, null, isbn);

  const title = pickString(existing.title, external.title, 'prefer_ext_if_db_empty') ?? existing.title;
  const author = pickString(existing.author, external.author, 'prefer_ext_if_db_empty');
  const publisher = pickString(existing.publisher, external.publisher, 'prefer_ext_if_db_empty');
  const description = pickString(existing.description, external.description, 'prefer_longer');
  const genre = pickString(existing.genre, external.genre, 'prefer_ext_if_db_empty');
  const language = pickString(existing.language, external.language, 'prefer_ext_if_db_empty');
  const coverPath = isValidCoverUrl(existing.coverPath)
    ? existing.coverPath
    : extCover ?? existing.coverPath;
  const year = pickNumber(existing.year, external.year);
  const pages = pickNumber(existing.pages, external.pages);

  const data: Partial<Book> = {};
  const updatedFields: string[] = [];

  if (title !== existing.title) {
    data.title = title;
    updatedFields.push('title');
  }
  if (author !== existing.author) {
    data.author = author;
    updatedFields.push('author');
  }
  if (publisher !== existing.publisher) {
    data.publisher = publisher;
    updatedFields.push('publisher');
  }
  if (description !== existing.description) {
    data.description = description;
    updatedFields.push('description');
  }
  if (genre !== existing.genre) {
    data.genre = genre;
    updatedFields.push('genre');
  }
  if (language !== existing.language) {
    data.language = language;
    updatedFields.push('language');
  }
  if (year !== existing.year) {
    data.year = year;
    updatedFields.push('year');
  }
  if (pages !== existing.pages) {
    data.pages = pages;
    updatedFields.push('pages');
  }
  if (coverPath && coverPath !== existing.coverPath) {
    data.coverPath = coverPath;
    updatedFields.push('coverPath');
  }

  const beforeScore = metadataScore(snapshotFromDb(existing));
  const afterBook = { ...existing, ...data, title, author, publisher, description, genre, language, year, pages, coverPath: coverPath ?? existing.coverPath };
  const mergedSnapshot = snapshotFromDb(afterBook);
  const afterScore = metadataScore(mergedSnapshot);

  if (afterScore > beforeScore && updatedFields.length === 0) {
    updatedFields.push('(score↑ senza campi singoli)');
  }

  if (updatedFields.length > 0) {
    const fromGoogle = provider === 'google';
    data.source = fromGoogle ? 'google_books' : existing.source === 'google_books' ? existing.source : 'libery_db';
  }

  return { data, updatedFields, mergedSnapshot };
}

export function externalRicherThanDb(existing: Book, external: GoogleBookPayload): boolean {
  const dbSnap = snapshotFromDb(existing);
  const extSnap = snapshotFromPayload(external);
  if (!extSnap) return false;
  return metadataScore(extSnap) > metadataScore(dbSnap);
}
