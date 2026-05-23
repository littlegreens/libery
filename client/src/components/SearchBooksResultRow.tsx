import BookCoverThumb from '@/components/BookCoverThumb';
import { MdDivider, MdListItem } from '@/lib/material/md-react';

export type SearchRowBook = {
  id: string;
  title: string;
  author: string | null;
  isbn: string;
  coverPath?: string | null;
};

type Props = {
  book: SearchRowBook;
  /** Anteprima locale: punto suggerito o messaggio di stato. */
  supporting: string;
  isLast: boolean;
  onSelect: () => void;
};

/**
 * Voce compatta nella lista risultati ricerca: apre il bottom sheet (dettaglio Material).
 */
export default function SearchBooksResultRow({ book, supporting, isLast, onSelect }: Props) {
  return (
    <>
      <MdListItem type="button" className="libery-search-hit-row" onClick={onSelect}>
        <div slot="start" className="libery-search-hit-cover">
          <BookCoverThumb
            title={book.title}
            isbn={book.isbn}
            coverPath={book.coverPath}
            coverSize="list"
          />
        </div>
        <span slot="headline" className="book-title-clamp-2">
          {book.title}
        </span>
        <span slot="supporting-text" className="libery-search-hit-support">
          {book.author ? <span className="libery-search-hit-author">{book.author}</span> : null}
          {book.author ? <span aria-hidden> · </span> : null}
          <span className="libery-search-hit-hint text-muted">{supporting}</span>
        </span>
      </MdListItem>
      {!isLast ? <MdDivider /> : null}
    </>
  );
}
