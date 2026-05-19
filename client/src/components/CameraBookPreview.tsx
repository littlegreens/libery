import { Link } from 'react-router-dom';
import BookCoverThumb from '@/components/BookCoverThumb';

export type PreviewBook = {
  id: string;
  isbn: string;
  title: string;
  author: string | null;
  year?: number | null;
  genre?: string | null;
  description?: string | null;
  coverPath?: string | null;
};

type Props = {
  book: PreviewBook;
  provider?: 'google' | 'openlibrary' | 'wikidata' | 'db' | null;
  pointName?: string | null;
  availabilityMessage?: string | null;
  availabilityOk?: boolean;
};

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google Books',
  openlibrary: 'Open Library',
  wikidata: 'Wikidata',
  db: 'Catalogo Libery',
};

export default function CameraBookPreview({
  book,
  provider,
  pointName,
  availabilityMessage,
  availabilityOk,
}: Props) {
  const desc = book.description?.trim();

  return (
    <article className="camera-book-preview">
      <Link
        to={`/libro/${book.id}`}
        className="camera-book-preview-main"
        state={{ from: { to: '/camera', label: 'Torna alla scansione' } }}
      >
        <BookCoverThumb title={book.title} isbn={book.isbn} coverPath={book.coverPath} size={112} />
        <div className="camera-book-preview-text min-w-0">
          <h3 className="camera-book-preview-title book-title-clamp-2">{book.title}</h3>
          {book.author && <p className="camera-book-preview-author">{book.author}</p>}
          <p className="camera-book-preview-meta">
            {[book.year, book.genre].filter(Boolean).join(' · ')}
            {book.year || book.genre ? ' · ' : ''}
            ISBN {book.isbn}
          </p>
          {provider && (
            <span className="camera-book-preview-source">{PROVIDER_LABELS[provider] ?? provider}</span>
          )}
          <span className="camera-book-preview-cta">Apri scheda completa →</span>
        </div>
      </Link>

      {desc && (
        <section className="camera-book-preview-desc">
          <h4 className="camera-book-preview-desc-title">Trama</h4>
          <p className="camera-book-preview-desc-body">{desc}</p>
        </section>
      )}

      {pointName && (
        <p className="camera-book-preview-point small mb-0">
          Sei a <strong>{pointName}</strong>
        </p>
      )}

      {availabilityMessage && (
        <p
          className={`camera-flow-availability mb-0 ${availabilityOk ? 'is-ok' : 'is-warn'}`}
        >
          {availabilityMessage}
        </p>
      )}
    </article>
  );
}
