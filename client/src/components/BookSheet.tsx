import { Link } from 'react-router-dom';
import BookCoverThumb from '@/components/BookCoverThumb';
import { formatDistanceKm, haversineKm } from '@/lib/geo';
import { POINT_TYPE_LABELS } from '@/lib/mapIcons';
import type { BookSummary } from '@/types/book';
import type { MapPoint } from '@/types/point';
import type { PointType } from '@/types/point';

type Nearest = {
  availability: BookSummary['availability'][0];
  point: MapPoint;
  km: number;
};

type Props = {
  book: BookSummary;
  points: MapPoint[];
  userPos: { lat: number; lng: number } | null;
  onClose?: () => void;
  onGoToPoint?: (pointId: string) => void;
  compact?: boolean;
};

export function findNearestForBook(
  book: BookSummary,
  points: MapPoint[],
  userPos: { lat: number; lng: number } | null,
): Nearest | null {
  if (!userPos || book.availability.length === 0) return null;

  let best: Nearest | null = null;
  for (const slot of book.availability) {
    const point = points.find((p) => p.id === slot.pointId);
    if (point?.latitude == null || point.longitude == null) continue;
    const km = haversineKm(userPos.lat, userPos.lng, point.latitude, point.longitude);
    if (!best || km < best.km) {
      best = { availability: slot, point, km };
    }
  }
  return best;
}

export function enrichAvailability(
  book: BookSummary,
  points: MapPoint[],
): BookSummary {
  return {
    ...book,
    availability: book.availability.map((a) => {
      const p = points.find((x) => x.id === a.pointId);
      return {
        ...a,
        address: p?.address ?? a.address,
        latitude: p?.latitude ?? a.latitude,
        longitude: p?.longitude ?? a.longitude,
      };
    }),
  };
}

export default function BookSheet({
  book,
  points,
  userPos,
  onClose,
  onGoToPoint,
  compact = true,
}: Props) {
  const enriched = enrichAvailability(book, points);
  const nearest = findNearestForBook(enriched, points, userPos);

  return (
    <article className={`book-sheet ${compact ? 'book-sheet--compact' : ''}`}>
      {onClose && (
        <button type="button" className="book-sheet-close btn-close" onClick={onClose} aria-label="Chiudi" />
      )}

      <div className="book-sheet-main d-flex gap-3">
        <BookCoverThumb title={book.title} coverPath={book.coverPath} size={compact ? 64 : 88} />
        <div className="min-w-0 flex-grow-1">
          <Link
            to={`/libro/${book.id}`}
            state={{ from: { to: '/mappa', label: 'Torna alla mappa' } }}
            className="book-sheet-title book-title-clamp-2"
          >
            {book.title}
          </Link>
          {book.author && <p className="book-sheet-author">{book.author}</p>}
          {book.year && <p className="book-sheet-meta">{book.year}{book.genre ? ` · ${book.genre}` : ''}</p>}
          <p className="book-sheet-isbn">ISBN {book.isbn}</p>
        </div>
      </div>

      {nearest && (
        <section className="book-sheet-nearest">
          <p className="book-sheet-nearest-label">Più vicino a te</p>
          <button
            type="button"
            className="book-sheet-nearest-btn"
            onClick={() => onGoToPoint?.(nearest.point.id)}
          >
            <span className="book-sheet-nearest-name">{nearest.point.name}</span>
            {nearest.point.address || nearest.point.city ? (
              <span className="book-sheet-nearest-addr">
                {[nearest.point.address, nearest.point.city].filter(Boolean).join(', ')}
              </span>
            ) : null}
            <span className="book-sheet-nearest-meta">
              {POINT_TYPE_LABELS[nearest.availability.type as PointType]} · {formatDistanceKm(nearest.km)}
              {nearest.availability.copies > 0
                ? ` · ${nearest.availability.copies} ${nearest.availability.copies === 1 ? 'copia' : 'copie'}`
                : ''}
            </span>
          </button>
        </section>
      )}

      {!nearest && book.availability.length > 0 && (
        <p className="book-sheet-gps-hint small text-muted mb-0">
          Tocca il titolo per vedere tutti i punti dove è disponibile.
        </p>
      )}

      {book.availability.length === 0 && (
        <p className="book-sheet-gps-hint small text-muted mb-0">
          Non disponibile nei punti Libery al momento.
        </p>
      )}

      {!userPos && book.availability.length > 0 && (
        <p className="book-sheet-gps-hint small text-muted mb-0 mt-2">
          Attiva il GPS per il punto più vicino, oppure{' '}
          <Link
            to={`/libro/${book.id}`}
            state={{ from: { to: '/mappa', label: 'Torna alla mappa' } }}
          >
            apri la scheda
          </Link>{' '}
          del libro.
        </p>
      )}
    </article>
  );
}
