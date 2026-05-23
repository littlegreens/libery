import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import BookCoverThumb from '@/components/BookCoverThumb';
import BookListRowMenu, { type BookListRowMenuItems } from '@/components/BookListRowMenu';
import { formatCountdown, useNowTicker } from '@/components/BookCard';

export type BookListRowBook = {
  id: string;
  title: string;
  author?: string | null;
  isbn?: string;
  year?: number | null;
  coverPath?: string | null;
};

type ReservedProps = {
  expiresAt: string;
  /** Omesso nella scheda dello stesso punto (badge + countdown bastano). */
  pointName?: string;
  pointId?: string;
  badgeLabel?: string;
};

type Props = {
  book: BookListRowBook;
  linkState?: unknown;
  to?: string;
  copies?: number;
  onRowClick?: () => void;
  menu?: BookListRowMenuItems;
  reserved?: ReservedProps;
  subtitle?: ReactNode;
  isLast?: boolean;
};

function MetaLine({ isbn, year }: { isbn?: string; year?: number | null }) {
  if (!isbn && year == null) return null;
  return (
    <p className="libery-book-list-row__meta">
      {isbn ? <span className="libery-book-list-row__isbn">ISBN {isbn}</span> : null}
      {isbn && year != null ? <span className="libery-book-list-row__meta-sep"> · </span> : null}
      {year != null ? <span>{year}</span> : null}
    </p>
  );
}

function ReservedBody({
  expiresAt,
  pointName,
  pointId,
  badgeLabel = 'Prenotato',
}: ReservedProps) {
  const now = useNowTicker(30_000);
  const msLeft = new Date(expiresAt).getTime() - now;

  return (
    <div className="libery-book-list-row__reserved-block">
      <span className="libery-book-list-row__status-chip">{badgeLabel}</span>
      {pointName ? (
        pointId ? (
          <Link
            to={`/punto/${pointId}`}
            className="libery-book-list-row__reserved-point"
            onClick={(e) => e.stopPropagation()}
          >
            {pointName}
          </Link>
        ) : (
          <p className="libery-book-list-row__reserved-point libery-book-list-row__reserved-point--text">{pointName}</p>
        )
      ) : null}
      <p className="libery-book-list-row__reserved">{formatCountdown(msLeft)}</p>
    </div>
  );
}

export default function BookListRow({
  book,
  linkState,
  to,
  copies,
  onRowClick,
  menu,
  reserved,
  subtitle,
  isLast = true,
}: Props) {
  const navigate = useNavigate();
  const href = to ?? `/libro/${book.id}`;

  const openBook = () => {
    if (onRowClick) {
      onRowClick();
      return;
    }
    navigate(href, { state: linkState });
  };

  const showCopies = !reserved && copies != null && copies > 0;
  const hasMeta = Boolean(book.isbn || book.year != null);
  const showFoot = !reserved && !subtitle && (hasMeta || showCopies);

  return (
    <article
      className={['libery-book-list-row', !isLast ? 'libery-book-list-row--bordered' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <div className="libery-book-list-row__inner">
        <button type="button" className="libery-book-list-row__main" onClick={openBook}>
          <div className="libery-book-list-row__cover-wrap">
            <BookCoverThumb
              title={book.title}
              isbn={book.isbn}
              coverPath={book.coverPath}
              coverSize="list"
            />
          </div>
          <div className="libery-book-list-row__body">
            <p className="libery-book-list-row__title">{book.title}</p>
            {book.author ? <p className="libery-book-list-row__author">{book.author}</p> : null}
            {reserved ? (
              <ReservedBody {...reserved} />
            ) : (
              <>
                {subtitle ? <p className="libery-book-list-row__subtitle">{subtitle}</p> : null}
                {showFoot ? (
                  <div className="libery-book-list-row__foot">
                    {hasMeta ? (
                      <MetaLine isbn={book.isbn} year={book.year} />
                    ) : (
                      <span className="libery-book-list-row__foot-spacer" aria-hidden />
                    )}
                    {showCopies ? (
                      <p className="libery-book-list-row__copies-line">
                        numero copie: <span className="libery-book-list-row__copies-n">{copies}</span>
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </button>
        {menu ? <BookListRowMenu items={menu} /> : null}
      </div>
    </article>
  );
}
