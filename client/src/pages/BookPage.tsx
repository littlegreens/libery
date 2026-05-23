import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import BookSheetHero from '@/components/BookSheetHero';
import LiberyLoading from '@/components/LiberyLoading';
import BookDescriptionBody from '@/components/BookDescriptionBody';
import FavoriteStar from '@/components/FavoriteStar';
import PointAvailabilityRow from '@/components/PointAvailabilityRow';
import { useGpsDistanceSnackbar } from '@/hooks/useGpsDistanceSnackbar';
import { useBackTarget } from '@/components/BackLink';
import type { ShellOutletContext } from '@/components/AppShell';
import { haversineKm } from '@/lib/geo';
import { api } from '@/lib/api';
import { MdIcon, MdIconButton } from '@/lib/material/md-react';
import { shareLiberyLink } from '@/lib/share';
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
    publisher: string | null;
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

type BookLocationState = {
  from?: 'point' | string | { to: string; label: string };
  pointId?: string;
  pointName?: string;
  fromCamera?: boolean;
};

export default function BookPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { setPageBar, reopenCamera } = useOutletContext<ShellOutletContext>();
  const navState = location.state as BookLocationState | null;
  const fromPointId = navState?.from === 'point' ? navState.pointId : undefined;
  const fromCamera = navState?.fromCamera === true;
  const backTarget = useBackTarget();

  const [book, setBook] = useState<BookSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { pos: userPos } = useUserPosition();

  useDocumentTitle(book?.title ?? (loading ? null : 'Libro'));

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api
      .get<{ book: ApiBook }>(`/books/${id}`, { signal: controller.signal })
      .then(({ data }) => {
        const b = data.book;
        setBook({
          id: b.id,
          isbn: b.isbn,
          title: b.title,
          author: b.author,
          year: b.year,
          genre: b.genre,
          publisher: b.publisher,
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
      .catch((err) => {
        if (err?.code === 'ERR_CANCELED') return;
        setError('Libro non trovato');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [id]);

  const handleBackFromCamera = useCallback(() => {
    reopenCamera();
    navigate(backTarget.to, { replace: true });
  }, [reopenCamera, navigate, backTarget.to]);

  useEffect(() => {
    if (!book) {
      setPageBar({
        title: 'Libro',
        showBack: true,
        backFallback: backTarget,
        onBack: fromCamera ? handleBackFromCamera : undefined,
      });
      return () => setPageBar(null);
    }
    setPageBar({
      title: book.title,
      showBack: true,
      hideTitle: true,
      backFallback: backTarget,
      onBack: fromCamera ? handleBackFromCamera : undefined,
      trailing: (
        <div className="libery-contextual-top-bar__trailing-actions">
          <MdIconButton
            type="button"
            color="standard"
            aria-label="Condividi"
            onClick={() =>
              void shareLiberyLink({
                path: `/libro/${book.id}`,
                title: book.title,
                text: book.author ?? undefined,
              })
            }
          >
            <MdIcon>share</MdIcon>
          </MdIconButton>
          <FavoriteStar
            bookId={book.id}
            book={{
              id: book.id,
              isbn: book.isbn,
              title: book.title,
              author: book.author,
              year: book.year ?? null,
              genre: book.genre ?? null,
              coverPath: book.coverPath ?? null,
            }}
            variant="inline"
            size={22}
          />
        </div>
      ),
    });
    return () => setPageBar(null);
  }, [book, setPageBar, fromCamera, backTarget, handleBackFromCamera]);

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

  useGpsDistanceSnackbar(otherPoints.length > 0 && !userPos);

  return (
    <div className="page-content book-page">
      {loading && <LiberyLoading variant="page" />}
      {error && <p className="text-danger px-3 py-3" role="alert">{error}</p>}

      {book && (
        <div className="book-page-inner">
          <header className="book-page-hero">
            <BookSheetHero book={book} coverSize="hero" titleAs="h1" />
          </header>

          {book.description ? (
            <section className="book-page-section book-page-desc">
              <h2 className="book-page-section-title">Trama</h2>
              <BookDescriptionBody description={book.description} className="book-page-desc-body" />
            </section>
          ) : null}

          <section
            className="libery-book-sheet-section book-page-where"
            aria-labelledby="book-where-heading"
          >
            <h2 id="book-where-heading" className="libery-book-sheet-heading">
              {fromPointId ? 'Altre sedi' : 'Più vicino'}
            </h2>
            {otherPoints.length === 0 ? (
              <p className="libery-book-sheet-muted small mb-2">
                {fromPointId
                  ? 'Non risulta disponibile in altri punti al momento.'
                  : 'Nessun punto Libery ha copie in questo momento.'}
              </p>
            ) : null}
            <div className="libery-book-list libery-book-list--points">
              {otherPoints.length === 0 ? (
                <p className="libery-book-sheet-muted small mb-0">Non disponibile.</p>
              ) : (
                otherPoints.map((a, idx) => (
                  <PointAvailabilityRow
                    key={a.pointId}
                    row={{
                      pointId: a.pointId,
                      pointName: a.pointName,
                      type: a.type,
                      copies: a.copies,
                      address: a.address,
                      city: a.city,
                      km: a.km,
                    }}
                    isLast={idx === otherPoints.length - 1}
                    linkState={{
                      from: { to: `/libro/${book.id}`, label: `Torna a ${book.title}` },
                      bookId: book.id,
                      bookTitle: book.title,
                    }}
                  />
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
