import { type ReactNode, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import BookSheetHero from '@/components/BookSheetHero';
import PointAvailabilityRow from '@/components/PointAvailabilityRow';
import LiberyBottomSheet from '@/components/LiberyBottomSheet';
import { LiberyButton } from '@/lib/material/md-react';
import { useGpsDistanceSnackbar } from '@/hooks/useGpsDistanceSnackbar';
import { sortAvailabilityByDistance } from '@/lib/sortAvailabilityByDistance';
import type { BookAvailability } from '@/types/book';

export type PreviewBookLite = {
  id: string;
  isbn: string;
  title: string;
  author: string | null;
  year: number | null;
  genre: string | null;
  publisher?: string | null;
  description?: string | null;
  coverPath?: string | null;
  availability: BookAvailability[];
};

type Props = {
  book: PreviewBookLite;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userPos: { lat: number; lng: number } | null | undefined;
  backState?: unknown;
  /** Stato router per aprire la scheda libro completa e tornare alla ricerca. */
  bookLinkState?: unknown;
  footnote?: ReactNode;
};

/** Anteprima da ricerca: metadati + elenco «Più vicino» (~60% schermo). */
export default function BookSearchBottomSheet({
  book,
  open,
  onOpenChange,
  userPos,
  backState,
  bookLinkState,
  footnote,
}: Props) {
  return (
    <LiberyBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={book.title}
      panelClass="libery-bottom-sheet-panel--preview"
    >
      <BookSearchBottomInner
        book={book}
        userPos={userPos}
        onClose={() => onOpenChange(false)}
        backState={backState}
        bookLinkState={bookLinkState}
        footnote={footnote}
      />
    </LiberyBottomSheet>
  );
}

function BookSearchBottomInner({
  book,
  userPos,
  onClose,
  backState,
  bookLinkState,
  footnote,
}: {
  book: PreviewBookLite;
  userPos: { lat: number; lng: number } | null | undefined;
  onClose: () => void;
  backState?: unknown;
  bookLinkState?: unknown;
  footnote?: ReactNode;
}) {
  const navigate = useNavigate();

  const sorted = useMemo(
    () => sortAvailabilityByDistance(book.availability, userPos),
    [book.availability, userPos],
  );

  useGpsDistanceSnackbar(sorted.length > 0 && !userPos);

  function goPoint(pointId: string) {
    navigate(`/punto/${pointId}`, { state: backState });
    onClose();
  }

  function goBook() {
    navigate(`/libro/${book.id}`, { state: bookLinkState ?? backState });
    onClose();
  }

  return (
    <div className="libery-book-sheet libery-book-sheet--preview">
      <BookSheetHero book={book} onClick={goBook} />

      <div className="libery-book-sheet-actions">
        <LiberyButton
          type="button"
          color="tonal"
          size="small"
          className="libery-book-sheet-actions__btn"
          onClick={goBook}
        >
          Vai a scheda
        </LiberyButton>
      </div>

      {footnote ? <div className="libery-book-sheet-footnote">{footnote}</div> : null}

      <section className="libery-book-sheet-section" aria-labelledby="libery-sheet-near-heading">
        <h3 id="libery-sheet-near-heading" className="libery-book-sheet-heading">
          Più vicino
        </h3>
        <div className="libery-book-list libery-book-list--points">
          {sorted.length === 0 ? (
            <p className="libery-book-sheet-muted small mb-0 px-1">Non disponibile.</p>
          ) : (
            sorted.map((a, idx) => (
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
                isLast={idx === sorted.length - 1}
                onSelect={() => goPoint(a.pointId)}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
