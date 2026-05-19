import type { GoogleBookPayload } from './googleBooks.js';
import { isValidCoverUrl } from './coverPick.js';

const TAG = '[libro]';

export type FieldSnapshot = {
  title: string | null;
  author: string | null;
  publisher: string | null;
  year: number | null;
  descriptionLen: number;
  cover: string | null;
  pages: number | null;
  genre: string | null;
  language: string | null;
};

export function snapshotFromPayload(p: GoogleBookPayload | null): FieldSnapshot | null {
  if (!p) return null;
  return {
    title: p.title || null,
    author: p.author,
    publisher: p.publisher,
    year: p.year,
    descriptionLen: p.description?.trim().length ?? 0,
    cover: p.coverUrl,
    pages: p.pages,
    genre: p.genre,
    language: p.language,
  };
}

export function snapshotFromDb(book: {
  title: string;
  author: string | null;
  publisher: string | null;
  year: number | null;
  description: string | null;
  coverPath: string | null;
  pages: number | null;
  genre: string | null;
  language: string | null;
}): FieldSnapshot {
  return {
    title: book.title,
    author: book.author,
    publisher: book.publisher,
    year: book.year,
    descriptionLen: book.description?.trim().length ?? 0,
    cover: book.coverPath,
    pages: book.pages,
    genre: book.genre,
    language: book.language,
  };
}

/** Punteggio “ricchezza” metadati (per confrontare DB vs fonte esterna). */
export function metadataScore(s: FieldSnapshot): number {
  let score = 0;
  if (s.title && !/^ISBN\s*\d/i.test(s.title.trim())) score += 3;
  if (s.author) score += 2;
  if (s.cover && isValidCoverUrl(s.cover)) score += 4;
  if (s.descriptionLen > 0) score += Math.min(3, Math.ceil(s.descriptionLen / 200));
  if (s.publisher) score += 1;
  if (s.year) score += 1;
  if (s.pages) score += 1;
  if (s.genre) score += 1;
  return score;
}

function coverShort(url: string | null): string {
  if (!url) return '—';
  if (url.length <= 72) return url;
  return `${url.slice(0, 68)}…`;
}

export function logIsbnHeader(isbn: string, action: string) {
  console.log(`${TAG} ══ ISBN ${isbn} — ${action} ══`);
}

export function logSourceResult(
  isbn: string,
  source: string,
  status: string,
  payload: GoogleBookPayload | null,
  detail?: string,
) {
  const snap = snapshotFromPayload(payload);
  const extra = detail ? ` | ${detail}` : '';
  if (!snap) {
    console.log(`${TAG}   ${source}: ${status}${extra}`);
    return;
  }
  console.log(
    `${TAG}   ${source}: ${status}${extra} | score=${metadataScore(snap)} | titolo="${snap.title ?? '?'}" | autore=${snap.author ?? '—'} | copertina=${snap.cover ? 'sì' : 'no'} ${coverShort(snap.cover)} | trama=${snap.descriptionLen} car. | editore=${snap.publisher ?? '—'} | anno=${snap.year ?? '—'}`,
  );
}

export function logDbState(isbn: string, label: string, snap: FieldSnapshot) {
  console.log(
    `${TAG}   DB (${label}): score=${metadataScore(snap)} | titolo="${snap.title ?? '?'}" | autore=${snap.author ?? '—'} | copertina=${snap.cover ? 'sì' : 'no'} | trama=${snap.descriptionLen} car.`,
  );
}

export function logMergePlan(isbn: string, fields: string[], provider: string) {
  if (fields.length === 0) {
    console.log(`${TAG}   merge: nessun campo migliorato (resta DB o fonte attuale)`);
    return;
  }
  console.log(`${TAG}   merge: aggiorno da ${provider} → campi: ${fields.join(', ')}`);
}

export function logResponse(isbn: string, provider: string, snap: FieldSnapshot) {
  console.log(
    `${TAG}   → risposta: provider=${provider} | score=${metadataScore(snap)} | copertina=${snap.cover ? 'sì' : 'no'} | trama=${snap.descriptionLen} car.`,
  );
}
