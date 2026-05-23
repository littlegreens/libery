import { FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
import { api } from '@/lib/api';
import { getApiError } from '@/lib/apiError';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import BookSearchBottomSheet from '@/components/BookSearchBottomSheet';
import BookListRow from '@/components/BookListRow';
import LiberyOutlinedSearchField from '@/components/LiberyOutlinedSearchField';
import { LiberyButton } from '@/lib/material/md-react';
import { parseIsbn } from '@/lib/scanUtils';
import { useAuthStore } from '@/stores/authStore';
import { useUserPosition } from '@/stores/locationStore';
import type { ShellOutletContext } from '@/components/AppShell';
import {
  isSearchBooksPath,
  searchBooksBackState,
  useSearchBooksStore,
  type SearchBookResult,
  type SearchIsbnLookup,
} from '@/stores/searchBooksStore';
import { useMdNativeFormBridge } from '@/lib/useMdNativeFormBridge';
import { usePageScrollRestore } from '@/hooks/usePageScrollRestore';

function looksLikeIsbn(q: string): boolean {
  return parseIsbn(q) !== null;
}

export default function SearchBooksPage() {
  const { pathname } = useLocation();
  const loggedIn = useAuthStore((s) => s.isLoggedIn());
  const [q, setQ] = useState('');
  const [books, setBooks] = useState<SearchBookResult[]>([]);
  const [isbnResult, setIsbnResult] = useState<SearchIsbnLookup | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  /** Libro selezionato dalla lista risultati (bottom sheet). */
  const [picked, setPicked] = useState<SearchBookResult | null>(null);
  const { pos: userPos } = useUserPosition();
  const searchBackState = useMemo(() => searchBooksBackState(pathname), [pathname]);
  usePageScrollRestore(isSearchBooksPath(pathname) ? pathname : null);
  const saveSearchSnapshot = useSearchBooksStore((s) => s.save);
  const searchRestoredRef = useRef(false);
  const searchInputRef = useRef({ q, books, isbnResult, searched, picked, error });
  searchInputRef.current = { q, books, isbnResult, searched, picked, error };

  useLayoutEffect(() => {
    if (!isSearchBooksPath(pathname) || searchRestoredRef.current) return;
    const snap = useSearchBooksStore.getState().snapshot;
    if (!snap || snap.returnPath !== pathname || !snap.searched) return;
    searchRestoredRef.current = true;
    setQ(snap.q);
    setBooks(snap.books);
    setIsbnResult(snap.isbnResult);
    setSearched(snap.searched);
    setError(snap.error);
    const pickedBook =
      snap.books.find((b) => b.id === snap.pickedId) ??
      (snap.isbnResult?.book.id === snap.pickedId ? snap.isbnResult.book : null);
    setPicked(pickedBook);
  }, [pathname]);

  useEffect(() => {
    if (!isSearchBooksPath(pathname)) return;
    if (!searched && !q.trim()) return;
    saveSearchSnapshot({
      returnPath: pathname,
      q,
      books,
      isbnResult,
      searched,
      pickedId: picked?.id ?? null,
      error,
    });
  }, [pathname, q, books, isbnResult, searched, picked, error, saveSearchSnapshot]);

  useEffect(() => {
    if (!isSearchBooksPath(pathname)) return;
    return () => {
      const latest = searchInputRef.current;
      if (!latest.searched && !latest.q.trim()) return;
      saveSearchSnapshot({
        returnPath: pathname,
        q: latest.q,
        books: latest.books,
        isbnResult: latest.isbnResult,
        searched: latest.searched,
        pickedId: latest.picked?.id ?? null,
        error: latest.error,
      });
    };
  }, [pathname, saveSearchSnapshot]);

  const { setPageBar, openAuthSheet } = useOutletContext<ShellOutletContext>();
  const searchFormRef = useRef<HTMLFormElement>(null);
  useMdNativeFormBridge(searchFormRef);

  useDocumentTitle('Libri');

  useEffect(() => {
    setPageBar({
      title: 'Libri',
      showBack: false,
    });
    return () => setPageBar(null);
  }, [setPageBar]);

  async function lookupIsbn(isbnRaw: string) {
    const isbn = parseIsbn(isbnRaw);
    if (!isbn) {
      setError('ISBN non valido');
      return;
    }
    setLoading(true);
    setError('');
    setIsbnResult(null);
    setBooks([]);
    setPicked(null);
    setSearched(true);
    try {
      const { data } = await api.get<{
        book: Omit<SearchBookResult, 'availability'>;
        source: string;
        provider?: string;
        created: boolean;
      }>(`/books/isbn/${isbn}`);
      setIsbnResult({
        book: { ...data.book, availability: [] },
        source: data.source,
        provider: data.provider,
        created: data.created,
      });
    } catch (err) {
      setError(
        getApiError(err, 'Libro non trovato'),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleImportIsbn() {
    const isbn = parseIsbn(q);
    if (!isbn) return;
    setImporting(true);
    setError('');
    setPicked(null);
    try {
      const { data } = await api.post<{
        book: Omit<SearchBookResult, 'availability'>;
        source: string;
        created: boolean;
      }>('/books/import', { isbn });
      setIsbnResult({
        book: { ...data.book, availability: [] },
        source: data.source,
        created: data.created,
      });
    } catch (err) {
      setError(getApiError(err, 'Import non riuscito'));
    } finally {
      setImporting(false);
    }
  }

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;

    if (looksLikeIsbn(q.trim())) {
      await lookupIsbn(q.trim());
      return;
    }

    setLoading(true);
    setError('');
    setIsbnResult(null);
    setPicked(null);
    setSearched(true);
    try {
      const { data } = await api.get<{ books: SearchBookResult[] }>('/books/search', {
        params: { q: q.trim() },
      });
      setBooks(data.books);
    } catch (err) {
      setBooks([]);
      setError(getApiError(err, 'Ricerca non disponibile'));
    } finally {
      setLoading(false);
    }
  }

  function favoriteMenu(
    b: Pick<SearchBookResult, 'id' | 'isbn' | 'title' | 'author' | 'year' | 'genre' | 'coverPath'>,
  ) {
    return {
      favorite: {
        bookId: b.id,
        book: {
          id: b.id,
          isbn: b.isbn,
          title: b.title,
          author: b.author,
          year: b.year,
          genre: b.genre ?? null,
          coverPath: b.coverPath ?? null,
        },
        onNeedLogin: () => openAuthSheet('login'),
      },
    };
  }

  return (
    <div className="page-content libery-search-page">
      <form
        ref={searchFormRef}
        onSubmit={handleSearch}
        className="libery-search-form libery-search-form--page"
      >
        <div className="libery-search-row">
          <LiberyOutlinedSearchField
            className="libery-search-field"
            id="libery-search-books"
            label="Cerca"
            placeholder="Titolo, autore o ISBN…"
            value={q}
            onValueChange={setQ}
            disabled={loading || importing}
          />
        </div>
      </form>

      <div className="libery-search-page-body px-3 pb-3">

      {error && <p className="text-danger small" role="alert" aria-live="assertive">{error}</p>}

      {isbnResult && (
        <div className="libery-book-list mb-3">
          <BookListRow
            book={{
              id: isbnResult.book.id,
              title: isbnResult.book.title,
              author: isbnResult.book.author,
              isbn: isbnResult.book.isbn,
              year: isbnResult.book.year,
              coverPath: isbnResult.book.coverPath ?? null,
            }}
            isLast
            onRowClick={() => setPicked(isbnResult.book)}
            menu={loggedIn ? favoriteMenu(isbnResult.book) : undefined}
          />
        </div>
      )}

      {searched && !loading && !isbnResult && books.length === 0 && !error && (
        <p className="text-muted">Nessun libro trovato.</p>
      )}

      {loggedIn && looksLikeIsbn(q.trim()) && !isbnResult && searched && !loading && (
        <LiberyButton
          type="button"
          color="outlined"
          size="small"
          className="mb-3"
          disabled={importing}
          onClick={handleImportIsbn}
        >
          {importing ? 'Import…' : 'Riprova import da Google'}
        </LiberyButton>
      )}

      <div className="libery-book-list mb-0">
        {books.map((b, idx) => (
          <BookListRow
            key={b.id}
            book={{
              id: b.id,
              title: b.title,
              author: b.author,
              isbn: b.isbn,
              year: b.year,
              coverPath: b.coverPath ?? null,
            }}
            isLast={idx === books.length - 1}
            onRowClick={() => setPicked(b)}
            menu={loggedIn ? favoriteMenu(b) : undefined}
          />
        ))}
      </div>

      {picked ? (
        <BookSearchBottomSheet
          book={picked}
          open
          userPos={userPos}
          backState={searchBackState}
          bookLinkState={searchBackState}
          onOpenChange={(next) => {
            if (!next) setPicked(null);
          }}
          footnote={
            isbnResult && picked.id === isbnResult.book.id ? (
              <p className="small text-muted mb-0">
                {isbnResult.created
                  ? 'Aggiunto al catalogo. Puoi lasciarlo in un punto dalla fotocamera.'
                  : 'Già nel catalogo Libery.'}
              </p>
            ) : undefined
          }
        />
      ) : null}
      </div>
    </div>
  );
}
