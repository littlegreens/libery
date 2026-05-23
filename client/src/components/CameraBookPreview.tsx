import BookSheetHero, { type BookSheetHeroBook } from '@/components/BookSheetHero';

export type PreviewBook = BookSheetHeroBook & {
  id: string;
  description?: string | null;
};

type Props = {
  book: PreviewBook;
  onOpenBook: () => void;
};

/** Anteprima dopo scansione ISBN — stessa intestazione della scheda libro. */
export default function CameraBookPreview({ book, onOpenBook }: Props) {
  return (
    <div className="libery-book-sheet camera-flow-book-preview">
      <header className="book-page-hero">
        <BookSheetHero book={book} coverSize="hero" titleAs="h1" onClick={onOpenBook} />
      </header>
    </div>
  );
}
