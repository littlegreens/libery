import BookListRow from '@/components/BookListRow';
import type { SearchBookResult } from '@/stores/searchBooksStore';
import type { BookListRowMenuItems } from '@/components/BookListRowMenu';

export type DiscoverPayload = {
  nearby: SearchBookResult[];
  nearbyMeta: { radiusKm: number | null; usedGps: boolean };
  trending: SearchBookResult[];
  loved: SearchBookResult[];
};

type SectionProps = {
  title: string;
  subtitle: string;
  books: SearchBookResult[];
  loggedIn: boolean;
  favoriteMenu: (
    b: Pick<SearchBookResult, 'id' | 'isbn' | 'title' | 'author' | 'year' | 'genre' | 'coverPath'>,
  ) => { favorite: BookListRowMenuItems['favorite'] } | undefined;
  onPick: (book: SearchBookResult) => void;
};

function DiscoverSection({ title, subtitle, books, loggedIn, favoriteMenu, onPick }: SectionProps) {
  if (books.length === 0) return null;

  return (
    <section className="libery-discover-section mb-4" aria-labelledby={`discover-${title.replace(/\s+/g, '-')}`}>
      <header className="libery-discover-section__head mb-2">
        <h2 id={`discover-${title.replace(/\s+/g, '-')}`} className="libery-discover-section__title h6 fw-bold mb-0">
          {title}
        </h2>
        <p className="libery-discover-section__sub small text-muted mb-0">{subtitle}</p>
      </header>
      <div className="libery-book-list">
        {books.map((b, idx) => (
          <BookListRow
            key={b.id}
            book={{
              id: b.id,
              title: b.title,
              author: b.author,
              isbn: b.isbn,
              year: b.year,
              coverPath: b.coverPath ?? null,
            }}
            isLast={idx === books.length - 1}
            onRowClick={() => onPick(b)}
            menu={loggedIn ? favoriteMenu(b) : undefined}
            subtitle={
              b.availability?.[0]?.city ? (
                <span className="text-muted">{b.availability[0].city}</span>
              ) : undefined
            }
          />
        ))}
      </div>
    </section>
  );
}

type Props = {
  data: DiscoverPayload;
  loading: boolean;
  loggedIn: boolean;
  favoriteMenu: SectionProps['favoriteMenu'];
  onPick: (book: SearchBookResult) => void;
};

export default function BookDiscoverSections({ data, loading, loggedIn, favoriteMenu, onPick }: Props) {
  if (loading) {
    return <p className="text-muted small px-3">Caricamento suggerimenti…</p>;
  }

  const nearbySub = data.nearbyMeta.usedGps
    ? data.nearbyMeta.radiusKm != null && data.nearbyMeta.radiusKm <= 5
      ? 'Libri disponibili entro circa 5 km da te'
      : `I 3 titoli più vicini (fino a ~${data.nearbyMeta.radiusKm ?? '?'} km)`
    : 'Libri disponibili in rete — attiva il GPS per quelli vicini';

  return (
    <div className="libery-discover px-3 pb-2">
      <DiscoverSection
        title="Vicini a te"
        subtitle={nearbySub}
        books={data.nearby}
        loggedIn={loggedIn}
        favoriteMenu={favoriteMenu}
        onPick={onPick}
      />
      <DiscoverSection
        title="Più scambiati"
        subtitle="I titoli che girano di più in libery"
        books={data.trending}
        loggedIn={loggedIn}
        favoriteMenu={favoriteMenu}
        onPick={onPick}
      />
      <DiscoverSection
        title="Più amati"
        subtitle="I preferiti della community"
        books={data.loved}
        loggedIn={loggedIn}
        favoriteMenu={favoriteMenu}
        onPick={onPick}
      />
    </div>
  );
}
