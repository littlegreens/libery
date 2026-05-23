import { Link } from 'react-router-dom';
import BookCoverThumb from '@/components/BookCoverThumb';
import { useGpsDistanceSnackbar } from '@/hooks/useGpsDistanceSnackbar';
import { LiberyButton, MdCard, MdIcon, MdIconButton } from '@/lib/material/md-react';
import { formatDistanceKm, haversineKm } from '@/lib/geo';
import PointTypeBadge from '@/components/PointTypeBadge';
import { LiberyGenreLabel } from '@/components/LiberyMaterialChips';
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

export function enrichAvailability(book: BookSummary, points: MapPoint[]): BookSummary {
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

  useGpsDistanceSnackbar(book.availability.length > 0 && !userPos);

  return (
    <MdCard type="elevated" className="book-sheet-map-card">
      <div className={`book-sheet ${compact ? 'book-sheet--compact' : ''}`} role="article">
        {onClose && (
          <MdIconButton
            type="button"
            className="book-sheet-close"
            aria-label="Chiudi"
            color="standard"
            onClick={onClose}
          >
            <MdIcon>close</MdIcon>
          </MdIconButton>
        )}

        <div className="book-sheet-hero">
          <div className="book-sheet-cover">
            <BookCoverThumb
              title={book.title}
              coverPath={book.coverPath}
              isbn={book.isbn}
              coverSize={compact ? 'list' : 'sheet'}
            />
          </div>
          <div className="book-sheet-hero-body">
            <Link
              to={`/libro/${book.id}`}
              state={{ from: { to: '/mappa', label: 'Torna alla mappa' } }}
              className="book-sheet-title book-title-clamp-2"
            >
              {book.title}
            </Link>
            {book.author ? <p className="book-sheet-author">{book.author}</p> : null}
            {book.year ? <p className="book-sheet-meta">{book.year}</p> : null}
            {book.genre ? (
              <div className="libery-book-sheet-meta-line libery-book-sheet-meta-line--genre">
                <LiberyGenreLabel label={book.genre} />
              </div>
            ) : null}
            <p className="book-sheet-isbn">ISBN {book.isbn}</p>
          </div>
        </div>

        {nearest && (
          <section className="book-sheet-nearest">
            <p className="book-sheet-nearest-label">Più vicino a te</p>
            <LiberyButton
              type="button"
              color="tonal"
              className="book-sheet-nearest-btn"
              onClick={() => onGoToPoint?.(nearest.point.id)}
            >
              <span className="book-sheet-nearest-stack">
                <PointTypeBadge type={nearest.availability.type as PointType} size="medium" className="flush" />
                <span className="book-sheet-nearest-name">{nearest.point.name}</span>
                {nearest.point.address || nearest.point.city ? (
                  <span className="book-sheet-nearest-addr">
                    {[nearest.point.address, nearest.point.city].filter(Boolean).join(', ')}
                  </span>
                ) : null}
                <span className="book-sheet-nearest-meta-tail">
                  {formatDistanceKm(nearest.km)}
                  {nearest.availability.copies > 0
                    ? ` · ${nearest.availability.copies} ${nearest.availability.copies === 1 ? 'copia' : 'copie'}`
                    : ''}
                </span>
              </span>
            </LiberyButton>
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

      </div>
    </MdCard>
  );
}
