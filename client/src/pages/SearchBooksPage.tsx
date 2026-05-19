import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { api } from '@/lib/api';
import BookCard from '@/components/BookCard';
import { parseIsbn } from '@/lib/scanUtils';
import { formatDistanceKm, haversineKm } from '@/lib/geo';
import { POINT_TYPE_LABELS } from '@/lib/mapIcons';
import { useAuthStore } from '@/stores/authStore';
import { useUserPosition } from '@/stores/locationStore';
import type { PointType } from '@/types/point';

const SEARCH_BACK_STATE = { from: { to: '/cerca', label: 'Torna alla ricerca' } };

type Availability = {
  pointId: string;
  pointName: string;
  city: string | null;
  address?: string | null;
  type: PointType;
  copies: number;
  latitude?: number | null;
  longitude?: number | null;
};

type BookResult = {
  id: string;
  isbn: string;
  title: string;
  author: string | null;
  year: number | null;
  genre: string | null;
  coverPath?: string | null;
  source?: string;
  availability: Availability[];
};

type IsbnLookup = {
  book: BookResult;
  source: string;
  provider?: string;
  created: boolean;
};

function looksLikeIsbn(q: string): boolean {
  return parseIsbn(q) !== null;
}

/**
 * Sceglie una singola sede da mostrare nella card di ricerca:
 *  - se userPos disponibile e ci sono coordinate → la più vicina (mostriamo la distanza)
 *  - altrimenti → una a caso (deterministica sul bookId)
 * In entrambi i casi la dicitura mostrata in UI è sempre "Puoi trovarlo qui".
 */
function pickHighlight(
  bookId: string,
  availability: Availability[],
  userPos: { lat: number; lng: number } | null | undefined,
): { a: Availability; km: number | null } | null {
  if (availability.length === 0) return null;

  if (userPos) {
    let best: { a: Availability; km: number } | null = null;
    for (const a of availability) {
      if (a.latitude == null || a.longitude == null) continue;
      const km = haversineKm(userPos.lat, userPos.lng, a.latitude, a.longitude);
      if (!best || km < best.km) best = { a, km };
    }
    if (best) return best;
  }

  // Random deterministico: somma codici char del bookId modulo length
  let hash = 0;
  for (let i = 0; i < bookId.length; i++) hash = (hash + bookId.charCodeAt(i)) % availability.length;
  return { a: availability[hash], km: null };
}

export default function SearchBooksPage() {
  const loggedIn = useAuthStore((s) => s.isLoggedIn());
  const [q, setQ] = useState('');
  const [books, setBooks] = useState<BookResult[]>([]);
  const [isbnResult, setIsbnResult] = useState<IsbnLookup | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const { pos: userPos } = useUserPosition();

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
    setSearched(true);
    try {
      const { data } = await api.get<{
        book: Omit<BookResult, 'availability'>;
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
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setError('Libro non trovato. Controlla l\'ISBN o riprova più tardi.');
      } else {
        setError('Ricerca ISBN non disponibile — verifica che il server sia avviato');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleImportIsbn() {
    const isbn = parseIsbn(q);
    if (!isbn) return;
    setImporting(true);
    setError('');
    try {
      const { data } = await api.post<{
        book: Omit<BookResult, 'availability'>;
        source: string;
        created: boolean;
      }>('/books/import', { isbn });
      setIsbnResult({
        book: { ...data.book, availability: [] },
        source: data.source,
        created: data.created,
      });
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error ?? 'Import non riuscito'
        : 'Errore di rete';
      setError(msg);
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
    setSearched(true);
    try {
      const { data } = await api.get<{ books: BookResult[] }>('/books/search', {
        params: { q: q.trim() },
      });
      setBooks(data.books);
    } catch (err) {
      setBooks([]);
      setError(
        axios.isAxiosError(err) && err.response?.status === 400
          ? 'Inserisci almeno un carattere'
          : 'Ricerca non disponibile — verifica che il server sia avviato',
      );
    } finally {
      setLoading(false);
    }
  }

  // pre-calcolo highlight per ogni libro
  const booksWithHighlight = useMemo(
    () => books.map((b) => ({ book: b, highlight: pickHighlight(b.id, b.availability, userPos) })),
    [books, userPos],
  );

  return (
    <div className="page-content px-3 py-3">
      <h1 className="h5 fw-bold mb-1">Libri</h1>
      <p className="small text-muted mb-3">
        Cerca per titolo o inserisci un ISBN (10 o 13 cifre) per importare da Google Books.
      </p>

      <form onSubmit={handleSearch} className="mb-4">
        <div className="input-group">
          <input
            type="search"
            className="form-control"
            placeholder="Titolo, autore o ISBN…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="submit" className="btn btn-libery" disabled={loading || importing}>
            {loading ? '…' : looksLikeIsbn(q.trim()) ? 'ISBN' : 'Cerca'}
          </button>
        </div>
      </form>

      {error && <p className="text-danger small">{error}</p>}

      {isbnResult && (
        <ul className="list-unstyled mb-3 book-card-list">
          <BookCard
            book={isbnResult.book}
            linkState={SEARCH_BACK_STATE}
            coverBadge={
              isbnResult.provider === 'google'
                ? 'Google'
                : isbnResult.provider === 'openlibrary'
                  ? 'OpenLib'
                  : 'Catalogo'
            }
            subtitle={
              <>
                ISBN {isbnResult.book.isbn}
                {isbnResult.book.year ? ` · ${isbnResult.book.year}` : ''}
                <span className="d-block">
                  {isbnResult.created
                    ? 'Aggiunto al catalogo. Usa la fotocamera per lasciarlo in un punto.'
                    : 'Già nel catalogo Libery.'}
                </span>
              </>
            }
          />
        </ul>
      )}

      {searched && !loading && !isbnResult && books.length === 0 && !error && (
        <p className="text-muted">Nessun libro trovato.</p>
      )}

      {loggedIn && looksLikeIsbn(q.trim()) && !isbnResult && searched && !loading && (
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm mb-3"
          disabled={importing}
          onClick={handleImportIsbn}
        >
          {importing ? 'Import…' : 'Riprova import da Google'}
        </button>
      )}

      <ul className="list-unstyled mb-0 book-card-list">
        {booksWithHighlight.map(({ book: b, highlight }) => {
          const subtitle = highlight ? (
            <div className="search-book-where">
              <span className="search-book-where-label">puoi trovarlo qui:</span>
              <Link
                to={`/punto/${highlight.a.pointId}`}
                state={SEARCH_BACK_STATE}
                className="search-book-where-name"
              >
                {highlight.a.pointName}
              </Link>
              <span className="search-book-where-badge">
                <span className={`map-popup-type map-popup-type--${highlight.a.type}`}>
                  {POINT_TYPE_LABELS[highlight.a.type]}
                </span>
                {highlight.km != null && (
                  <span className="text-muted small">
                    · {formatDistanceKm(highlight.km)}
                  </span>
                )}
              </span>
              {(highlight.a.address || highlight.a.city) && (
                <span className="search-book-where-address">
                  {[highlight.a.address, highlight.a.city].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
          ) : (
            <span className="text-muted">Non disponibile nei punti Libery al momento.</span>
          );

          return (
            <BookCard
              key={b.id}
              book={b}
              linkState={SEARCH_BACK_STATE}
              coverBadge={
                highlight
                  ? `${highlight.a.copies} ${highlight.a.copies === 1 ? 'copia' : 'copie'}`
                  : undefined
              }
              subtitle={subtitle}
            />
          );
        })}
      </ul>
    </div>
  );
}
