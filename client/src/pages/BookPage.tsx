import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import BookCoverThumb from '@/components/BookCoverThumb';
import BackLink from '@/components/BackLink';
import FavoriteStar from '@/components/FavoriteStar';
import { formatDistanceKm, haversineKm } from '@/lib/geo';
import { api } from '@/lib/api';
import { POINT_TYPE_LABELS } from '@/lib/mapIcons';
import { useUserPosition } from '@/stores/locationStore';
import type { BookSummary } from '@/types/book';
import type { PointType } from '@/types/point';

type ApiBook = {
  id: string;
  isbn: string;
  title: string;
  author: string | null;
  year: number | null;
  genre: string | null;
  description: string | null;
  coverPath: string | null;
  pointBooks: Array<{
    copies: number;
    point: {
      id: string;
      name: string;
      city: string | null;
      type: PointType;
      address: string | null;
      latitude: number | null;
      longitude: number | null;
    };
  }>;
};

/**
 * Stato di navigazione legacy: alcune rotte ancora passano { from: 'point', pointId, pointName }.
 * Continua a funzionare in parallelo a {@link BackLink} che invece legge `state.from` come
 * BackTarget o pathname string.
 */
type BookLocationState = {
  from?: 'point' | string | { to: string; label: string };
  pointId?: string;
  pointName?: string;
};

export default function BookPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navState = location.state as BookLocationState | null;
  const fromPointId = navState?.from === 'point' ? navState.pointId : undefined;

  const [book, setBook] = useState<BookSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { pos: userPos } = useUserPosition();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .get<{ book: ApiBook }>(`/books/${id}`)
      .then(({ data }) => {
        const b = data.book;
        setBook({
          id: b.id,
          isbn: b.isbn,
          title: b.title,
          author: b.author,
          year: b.year,
          genre: b.genre,
          description: b.description,
          coverPath: b.coverPath,
          availability: b.pointBooks.map((pb) => ({
            pointId: pb.point.id,
            pointName: pb.point.name,
            city: pb.point.city,
            type: pb.point.type,
            copies: pb.copies,
            address: pb.point.address,
            latitude: pb.point.latitude,
            longitude: pb.point.longitude,
          })),
        });
      })
      .catch(() => setError('Libro non trovato'))
      .finally(() => setLoading(false));
  }, [id]);

  const otherPoints = useMemo(() => {
    if (!book) return [];
    let rows = book.availability;
    if (fromPointId) {
      rows = rows.filter((a) => a.pointId !== fromPointId);
    }
    return rows
      .map((a) => {
        const km =
          userPos && a.latitude != null && a.longitude != null
            ? haversineKm(userPos.lat, userPos.lng, a.latitude, a.longitude)
            : null;
        return { ...a, km };
      })
      .sort((a, b) => {
        if (a.km != null && b.km != null) return a.km - b.km;
        if (a.km != null) return -1;
        if (b.km != null) return 1;
        return a.pointName.localeCompare(b.pointName);
      });
  }, [book, userPos, fromPointId]);

  return (
    <div className="page-content book-page px-3 py-3">
      <div className="book-page-topbar">
        <BackLink />
        {book && (
          <FavoriteStar
            bookId={book.id}
            book={{
              id: book.id,
              isbn: book.isbn,
              title: book.title,
              author: book.author,
              year: book.year,
              genre: book.genre,
              coverPath: book.coverPath,
            }}
            variant="inline"
            size={18}
          />
        )}
      </div>

      {loading && <p className="text-muted">Caricamento…</p>}
      {error && <p className="text-danger">{error}</p>}

      {book && (
        <>
          <header className="book-page-hero d-flex gap-3 mb-3">
            <BookCoverThumb title={book.title} isbn={book.isbn} coverPath={book.coverPath} size={96} />
            <div className="min-w-0">
              <h1 className="h5 fw-bold mb-1 book-title-clamp-2">{book.title}</h1>
              {book.author && (
                <p className="text-muted mb-1 book-title-clamp-2">{book.author}</p>
              )}
              {book.year && <p className="small text-muted mb-1">{book.year}</p>}
              {book.genre && <span className="badge text-bg-light">{book.genre}</span>}
              <p className="small text-muted mt-2 mb-0">ISBN {book.isbn}</p>
            </div>
          </header>

          {book.description && (
            <section className="book-page-desc mb-4">
              <h2 className="h6 fw-bold">Trama</h2>
              <p className="small text-muted mb-0">{book.description}</p>
            </section>
          )}

          <section className="book-page-where">
            <h2 className="h6 fw-bold mb-1">Puoi trovarlo anche</h2>
            <p className="small text-muted mb-3">
              {fromPointId
                ? 'Altre sedi vicine a te con copie disponibili'
                : 'Le sedi Libery più vicine a te'}
            </p>
            {otherPoints.length === 0 ? (
              <p className="text-muted small mb-0">
                {fromPointId
                  ? 'Non risulta disponibile in altri punti al momento.'
                  : 'Non disponibile in nessun punto al momento.'}
              </p>
            ) : (
              <ul className="list-unstyled book-page-points mb-0">
                {otherPoints.map((a) => (
                  <li key={a.pointId} className="book-page-point-item">
                    <Link
                      to={`/punto/${a.pointId}`}
                      className="book-page-point-link"
                      state={{
                        from: { to: `/libro/${book.id}`, label: `Torna a ${book.title}` },
                        bookId: book.id,
                        bookTitle: book.title,
                      }}
                    >
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <div className="min-w-0">
                          <strong className="d-block book-page-point-name">{a.pointName}</strong>
                          {(a.address || a.city) && (
                            <span className="small text-muted d-block">
                              {[a.address, a.city].filter(Boolean).join(', ')}
                            </span>
                          )}
                          <span className="small book-page-point-type d-block">
                            {POINT_TYPE_LABELS[a.type]}
                            {' · '}
                            {a.copies} {a.copies === 1 ? 'copia' : 'copie'}
                          </span>
                        </div>
                        {a.km != null ? (
                          <span className="book-page-point-dist">{formatDistanceKm(a.km)}</span>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {!userPos && otherPoints.length > 0 && (
              <p className="small text-muted mt-2 mb-0">
                Attiva la posizione per vedere a quanti km sei da ogni sede.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
