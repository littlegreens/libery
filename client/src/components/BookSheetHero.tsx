import BookCoverThumb from '@/components/BookCoverThumb';
import { LiberyAssistLabelChip } from '@/components/LiberyMaterialChips';

export type BookSheetHeroBook = {
  title: string;
  author: string | null;
  publisher?: string | null;
  year?: number | null;
  genre?: string | null;
  isbn: string;
  coverPath?: string | null;
};

type Props = {
  book: BookSheetHeroBook;
  coverSize?: 'sheet' | 'hero' | 'preview' | 'list';
  onClick?: () => void;
  /** `h1` sulla scheda libro completa. */
  titleAs?: 'h1' | 'div';
};

/** Intestazione libro condivisa: bottom sheet, scheda pagina, overlay fotocamera. */
export default function BookSheetHero({ book, coverSize = 'sheet', onClick, titleAs = 'div' }: Props) {
  const TitleTag = titleAs;
  const publisherYear = [book.publisher?.trim(), book.year].filter(Boolean);
  const Wrapper = onClick ? 'button' : 'div';
  const wrapperProps = onClick
    ? {
        type: 'button' as const,
        onClick,
        'aria-label': `Apri scheda di ${book.title}`,
      }
    : {};

  return (
    <Wrapper
      className={[
        'libery-book-sheet-hero',
        onClick ? 'libery-book-sheet-hero--link' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      {...wrapperProps}
    >
      <div className="libery-book-sheet-cover">
        <BookCoverThumb
          title={book.title}
          isbn={book.isbn}
          coverPath={book.coverPath}
          coverSize={coverSize === 'preview' ? 'preview' : coverSize === 'hero' ? 'hero' : 'sheet'}
        />
      </div>
      <div className="libery-book-sheet-hero-meta">
        <TitleTag
          className={[
            titleAs === 'h1' ? 'libery-page-title libery-page-title--detail book-page-title-in-hero' : '',
            'libery-book-sheet-title book-title-clamp-2',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {book.title}
        </TitleTag>
        {book.author ? <div className="libery-book-sheet-author">{book.author}</div> : null}
        {publisherYear.length > 0 ? (
          <div className="libery-book-sheet-meta-line libery-book-sheet-meta-line--publisher">
            {book.publisher?.trim() ? <span>{book.publisher.trim()}</span> : null}
            {book.publisher?.trim() && book.year ? <span aria-hidden> · </span> : null}
            {book.year ? <span>{book.year}</span> : null}
          </div>
        ) : null}
        {book.genre ? (
          <div className="libery-book-sheet-meta-line libery-book-sheet-meta-line--genre">
            <LiberyAssistLabelChip label={book.genre} />
          </div>
        ) : null}
        <p className="libery-book-sheet-isbn mb-0">ISBN {book.isbn}</p>
      </div>
    </Wrapper>
  );
}
