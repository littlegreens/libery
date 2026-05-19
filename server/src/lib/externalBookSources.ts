import { mergeBookMetadata, withCoverFallback } from './bookMetadataMerge.js';
import { isValidCoverUrl, normalizeCoverUrl, pickCoverUrl } from './coverPick.js';
import { fetchBookFromGoogleBooks } from './googleBooks.js';
import { fetchBookFromOpenLibrary } from './openLibrary.js';
import { fetchBookFromWikidata } from './wikidataBooks.js';
import type { GoogleBookPayload } from './googleBooks.js';
import { logSourceResult } from './bookResolveLog.js';
import { normalizeIsbn } from './isbn.js';

export type ExternalProvider = 'google' | 'openlibrary' | 'wikidata';

export type SourceAttempt = {
  source: ExternalProvider | 'google_books';
  status: 'found' | 'not_found' | 'skipped' | 'error';
  detail?: string;
  snapshot?: ReturnType<typeof import('./bookResolveLog.js').snapshotFromPayload>;
};

export type ExternalFetchResult = {
  book: GoogleBookPayload | null;
  provider: ExternalProvider | null;
  attempts: SourceAttempt[];
  bySource: Partial<Record<ExternalProvider | 'google_books', GoogleBookPayload | null>>;
};

function needsMoreMetadata(book: GoogleBookPayload): boolean {
  return (
    !book.description?.trim() ||
    !book.author?.trim() ||
    !book.publisher?.trim() ||
    !isValidCoverUrl(book.coverUrl)
  );
}

/**
 * Google Books (copertina + metadati) → Open Library / Wikidata solo per campi mancanti.
 */
export async function fetchExternalBookMetadata(rawIsbn: string): Promise<ExternalFetchResult> {
  const isbn = normalizeIsbn(rawIsbn);
  const attempts: SourceAttempt[] = [];
  const bySource: ExternalFetchResult['bySource'] = {};
  if (!isbn) {
    return { book: null, provider: null, attempts, bySource };
  }

  const hasGoogleKey = Boolean(process.env.GOOGLE_BOOKS_API_KEY?.trim());
  let book: GoogleBookPayload | null = null;
  let provider: ExternalProvider | null = null;
  let googleCover: string | null = null;

  if (hasGoogleKey) {
    let fromGoogle: GoogleBookPayload | null = null;
    try {
      fromGoogle = await fetchBookFromGoogleBooks(isbn);
      if (fromGoogle?.coverUrl) {
        googleCover = (await normalizeCoverUrl(fromGoogle.coverUrl)) ?? null;
        fromGoogle = { ...fromGoogle, coverUrl: googleCover };
      }
      attempts.push({ source: 'google_books', status: fromGoogle ? 'found' : 'not_found' });
      logSourceResult(isbn, 'Google Books', fromGoogle ? 'TROVATO' : 'non trovato', fromGoogle);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      attempts.push({ source: 'google_books', status: 'error', detail: msg });
      logSourceResult(isbn, 'Google Books', 'ERRORE', null, msg);
    }
    bySource.google_books = fromGoogle;
    if (fromGoogle) {
      book = fromGoogle;
      provider = 'google';
    }
  } else {
    attempts.push({
      source: 'google_books',
      status: 'skipped',
      detail: 'GOOGLE_BOOKS_API_KEY assente in server/.env',
    });
    logSourceResult(isbn, 'Google Books', 'SALTATO', null, 'manca GOOGLE_BOOKS_API_KEY');
    bySource.google_books = null;
  }

  const skipSecondary = book && isValidCoverUrl(book.coverUrl) && !needsMoreMetadata(book);

  if (!skipSecondary) {
    let fromOl: GoogleBookPayload | null = null;
    try {
      fromOl = await fetchBookFromOpenLibrary(isbn);
      if (fromOl?.coverUrl) {
        const olCover = await normalizeCoverUrl(fromOl.coverUrl);
        fromOl = { ...fromOl, coverUrl: olCover };
      }
      attempts.push({ source: 'openlibrary', status: fromOl ? 'found' : 'not_found' });
      logSourceResult(isbn, 'Open Library', fromOl ? 'TROVATO' : 'non trovato', fromOl);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      attempts.push({ source: 'openlibrary', status: 'error', detail: msg });
      logSourceResult(isbn, 'Open Library', 'ERRORE', null, msg);
    }
    bySource.openlibrary = fromOl;
    if (fromOl) {
      if (book) {
        book = mergeBookMetadata(book, fromOl);
        logSourceResult(isbn, 'Open Library', 'MERGE (solo campi mancanti)', book);
      } else {
        book = withCoverFallback(fromOl, isbn);
        provider = 'openlibrary';
      }
    }

    if (book && needsMoreMetadata(book)) {
      let fromWd: GoogleBookPayload | null = null;
      try {
        fromWd = await fetchBookFromWikidata(isbn);
        attempts.push({ source: 'wikidata', status: fromWd ? 'found' : 'not_found' });
        logSourceResult(isbn, 'Wikidata', fromWd ? 'TROVATO' : 'non trovato', fromWd);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        attempts.push({ source: 'wikidata', status: 'error', detail: msg });
        logSourceResult(isbn, 'Wikidata', 'ERRORE', null, msg);
      }
      bySource.wikidata = fromWd;
      if (fromWd) {
        if (book) {
          book = mergeBookMetadata(book, fromWd);
          logSourceResult(isbn, 'Wikidata', 'MERGE (solo campi mancanti)', book);
        } else {
          book = fromWd;
          provider = 'wikidata';
        }
      }
    } else if (book) {
      attempts.push({
        source: 'wikidata',
        status: 'skipped',
        detail: 'metadati già sufficienti',
      });
      bySource.wikidata = null;
    }
  } else {
    attempts.push({
      source: 'openlibrary',
      status: 'skipped',
      detail: 'Google Books completo (copertina + metadati)',
    });
    attempts.push({
      source: 'wikidata',
      status: 'skipped',
      detail: 'Google Books completo',
    });
    bySource.openlibrary = null;
    bySource.wikidata = null;
    logSourceResult(isbn, 'Open Library', 'SALTATO', book, 'dati da Google sufficienti');
    logSourceResult(isbn, 'Wikidata', 'SALTATO', null, 'dati da Google sufficienti');
  }

  if (book) {
    const finalCover = await pickCoverUrl(googleCover ?? book.coverUrl, bySource.openlibrary?.coverUrl ?? null, isbn);
    book = { ...book, coverUrl: finalCover };
    if (!book.coverUrl) {
      logSourceResult(isbn, 'Copertina', 'NESSUNA valida', book);
    }
    logSourceResult(isbn, 'TOTALE fonti', `provider=${provider ?? '?'}`, book);
  }

  return { book, provider, attempts, bySource };
}
