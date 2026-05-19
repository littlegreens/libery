import type { Book } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import {
  fetchExternalBookMetadata,
  type ExternalFetchResult,
  type ExternalProvider,
  type SourceAttempt,
} from '../lib/externalBookSources.js';
import { snapshotFromPayload, type FieldSnapshot } from '../lib/bookResolveLog.js';
import { externalRicherThanDb, planDbUpdateFromExternal } from '../lib/bookFieldMerge.js';
import {
  logDbState,
  logIsbnHeader,
  logMergePlan,
  logResponse,
  snapshotFromDb,
} from '../lib/bookResolveLog.js';
import { bookNeedsExternalEnrichment, coverNeedsProbe } from '../lib/bookEnrichment.js';
import { isValidCoverUrl, pickCoverUrlSync, probeCoverUrl } from '../lib/coverPick.js';
import { normalizeIsbn } from '../lib/isbn.js';

export type BookDto = {
  id: string;
  isbn: string;
  title: string;
  author: string | null;
  year: number | null;
  genre: string | null;
  description: string | null;
  publisher: string | null;
  coverPath: string | null;
  source: Book['source'];
};

export type ResolveBookResult =
  | {
      ok: true;
      book: Book;
      created: boolean;
      fromGoogle: boolean;
      provider?: ExternalProvider | 'db';
      /** Record già completo in DB: nessuna API esterna chiamata. */
      fromCache?: boolean;
      attempts: SourceAttempt[];
      fieldsUpdated: string[];
      sourceSnapshots?: Record<string, FieldSnapshot | null>;
    }
  | {
      ok: false;
      attempts: SourceAttempt[];
    };

export function toBookDto(book: Book): BookDto {
  return {
    id: book.id,
    isbn: book.isbn,
    title: book.title,
    author: book.author,
    year: book.year,
    genre: book.genre,
    description: book.description,
    publisher: book.publisher,
    coverPath: book.coverPath,
    source: book.source,
  };
}

/** Aggiorna metadati per libri senza copertina in DB. */
export async function enrichBooksMissingCovers(limit = 20): Promise<number> {
  const rows = await prisma.book.findMany({
    select: { isbn: true, coverPath: true },
    take: limit * 3,
  });
  const needsCover = rows.filter((r) => !isValidCoverUrl(r.coverPath)).slice(0, limit);
  let updated = 0;
  for (const row of needsCover) {
    const result = await resolveBookByIsbn(row.isbn);
    if (result.ok && result.fieldsUpdated.length > 0) updated++;
  }
  return updated;
}

export async function findBookByIsbn(rawIsbn: string): Promise<Book | null> {
  const isbn = normalizeIsbn(rawIsbn);
  if (!isbn) return null;
  return prisma.book.findUnique({ where: { isbn } });
}

/**
 * Risolve ISBN: DB locale; API esterne solo se il libro manca o ha campi vuoti/non validi.
 */
export async function resolveBookByIsbn(rawIsbn: string): Promise<ResolveBookResult> {
  const isbn = normalizeIsbn(rawIsbn);
  if (!isbn) return { ok: false, attempts: [] };

  logIsbnHeader(isbn, 'risoluzione catalogo');
  const existing = await prisma.book.findUnique({ where: { isbn } });
  if (existing) {
    logDbState(isbn, 'prima', snapshotFromDb(existing));
  } else {
    console.log('[libro]   DB: libro non presente');
  }

  if (existing && !bookNeedsExternalEnrichment(existing)) {
    let coverOk = true;
    if (coverNeedsProbe(existing.coverPath)) {
      coverOk = Boolean(existing.coverPath && (await probeCoverUrl(existing.coverPath)));
    }
    if (coverOk) {
      console.log('[libro]   DB: catalogo completo — solo database (0 API esterne)');
      logResponse(isbn, 'db (completo)', snapshotFromDb(existing));
      return {
        ok: true,
        book: existing,
        created: false,
        fromGoogle: existing.source === 'google_books',
        provider: 'db',
        fromCache: true,
        attempts: [
          { source: 'google_books', status: 'skipped', detail: 'catalogo DB completo' },
          { source: 'openlibrary', status: 'skipped', detail: 'catalogo DB completo' },
          { source: 'wikidata', status: 'skipped', detail: 'catalogo DB completo' },
        ],
        fieldsUpdated: [],
      };
    }
    console.log('[libro]   DB: copertina sospetta — riinterrogo API (Google prima)');
  }

  const externalResult = await fetchExternalBookMetadata(isbn);
  const { book: external, provider, attempts, bySource } = externalResult;
  const sourceSnapshots = {
    google_books: snapshotFromPayload(bySource.google_books ?? null),
    openlibrary: snapshotFromPayload(bySource.openlibrary ?? null),
    wikidata: snapshotFromPayload(bySource.wikidata ?? null),
    merged: snapshotFromPayload(external),
  };

  if (!external) {
    if (existing) {
      logResponse(isbn, 'db (fonti esterne vuote)', snapshotFromDb(existing));
      return {
        ok: true,
        book: existing,
        created: false,
        fromGoogle: existing.source === 'google_books',
        provider: 'db',
        attempts,
        fieldsUpdated: [],
        sourceSnapshots,
      };
    }
    console.log(
      `[libro]   NON TROVATO — tentativi: ${attempts.map((a) => `${a.source}=${a.status}${a.detail ? `(${a.detail})` : ''}`).join(', ')}`,
    );
    return { ok: false, attempts };
  }

  const fromGoogle = provider === 'google';
  const dbSource: Book['source'] = fromGoogle ? 'google_books' : 'libery_db';

  if (existing) {
    const shouldUpdate =
      externalRicherThanDb(existing, external) ||
      (!isValidCoverUrl(existing.coverPath) && isValidCoverUrl(external.coverUrl)) ||
      (external.description?.trim().length ?? 0) > (existing.description?.trim().length ?? 0);
    if (!shouldUpdate) {
      logMergePlan(isbn, [], provider ?? 'esterno');
      logResponse(isbn, 'db (già sufficiente)', snapshotFromDb(existing));
      return {
        ok: true,
        book: existing,
        created: false,
        fromGoogle: existing.source === 'google_books',
        provider: 'db',
        attempts,
        fieldsUpdated: [],
        sourceSnapshots,
      };
    }

    const { data, updatedFields } = planDbUpdateFromExternal(
      existing,
      external,
      provider ?? 'openlibrary',
    );
    logMergePlan(isbn, updatedFields, provider ?? 'esterno');

    const book =
      updatedFields.length > 0
        ? await prisma.book.update({
            where: { isbn },
            data: {
              ...data,
              edition: external.edition ?? existing.edition,
            },
          })
        : existing;

    logResponse(isbn, updatedFields.length > 0 ? (provider ?? 'merge') : 'db', snapshotFromDb(book));
    return {
      ok: true,
      book,
      created: false,
      fromGoogle: book.source === 'google_books',
      provider: updatedFields.length > 0 ? provider ?? undefined : 'db',
      attempts,
      fieldsUpdated: updatedFields,
      sourceSnapshots,
    };
  }

  const book = await prisma.book.create({
    data: {
      isbn: external.isbn,
      title: external.title,
      author: external.author,
      publisher: external.publisher,
      year: external.year,
      edition: external.edition,
      description: external.description,
      language: external.language,
      pages: external.pages,
      genre: external.genre,
      coverPath: pickCoverUrlSync(external.coverUrl, null, isbn),
      source: dbSource,
    },
  });

  logResponse(isbn, provider ?? 'esterno', snapshotFromDb(book));
  return {
    ok: true,
    book,
    created: true,
    fromGoogle,
    provider: provider ?? undefined,
    attempts,
    fieldsUpdated: ['creato'],
    sourceSnapshots,
  };
}

export type { SourceAttempt, ExternalFetchResult };
