import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import BookCoverThumb from '@/components/BookCoverThumb';

export type BookCardBook = {
  id: string;
  title: string;
  author?: string | null;
  isbn?: string;
  coverPath?: string | null;
  year?: number | null;
};

type ReservedInfo = {
  /** ISO string scadenza reservation */
  expiresAt: string;
  /** Etichetta del badge (default: "PRENOTATO"). */
  badgeLabel?: string;
  /** Nome punto dove la copia è riservata. */
  pointName?: string | null;
  /** Id del punto (se valorizzato, il nome diventa link a /punto/:id). */
  pointId?: string | null;
  /** Indirizzo punto (sotto al nome). */
  pointAddress?: string | null;
  /** Slot pulsanti a destra (es. "Lascia"). */
  actions?: ReactNode;
};

type Props = {
  book: BookCardBook;
  /** Destinazione del link principale (default `/libro/:id`). */
  to?: string;
  /** State per il link (per BackLink dinamico). */
  linkState?: unknown;
  /** Badge sotto la cover (chip neutra). */
  coverBadge?: ReactNode;
  /** Slot extra sotto il blocco titolo/autore (fuori dal Link). */
  subtitle?: ReactNode;
  /** Slot azioni a destra (Prendi, Prenota, Lascia…). */
  actions?: ReactNode;
  /**
   * Quando presente abilita la variante "prenotato":
   * stesso layout cover+body ma il body contiene badge verde,
   * countdown e info punto (con eventuale link al punto).
   */
  reserved?: ReservedInfo;
};

/**
 * Formatta un countdown leggibile da millisecondi residui.
 *  - < 1 min  → "Scade ora"
 *  - < 1 ora  → "Scade tra Xm"
 *  - < 24 ore → "Scade tra Xh Ym"
 *  - >= 24 ore → "Scade tra Xg Yh"
 */
export function formatCountdown(msLeft: number): string {
  if (msLeft <= 0) return 'Scaduta';
  const totalMin = Math.floor(msLeft / 60000);
  if (totalMin < 1) return 'Scade ora';
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const minutes = totalMin % 60;
  if (days > 0) return `Scade tra ${days}g ${hours}h`;
  if (hours > 0) return `Scade tra ${hours}h ${minutes}m`;
  return `Scade tra ${minutes}m`;
}

/**
 * Tick globale del "now": forza un re-render ogni `intervalMs` ms.
 * Adatto a countdown a granularità di minuti.
 */
export function useNowTicker(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export default function BookCard({
  book,
  to,
  linkState,
  coverBadge,
  subtitle,
  actions,
  reserved,
}: Props) {
  const href = to ?? `/libro/${book.id}`;

  const titleArea = (
    <Link to={href} state={linkState} className="book-card-titles">
      <span className="book-card-title">{book.title}</span>
      {!reserved && book.author && <span className="book-card-author">{book.author}</span>}
    </Link>
  );

  const extraNode = reserved ? (
    <ReservedMeta
      expiresAt={reserved.expiresAt}
      badgeLabel={reserved.badgeLabel}
      pointName={reserved.pointName}
      pointId={reserved.pointId}
      pointAddress={reserved.pointAddress}
    />
  ) : subtitle ? (
    <div className="book-card-subtitle">{subtitle}</div>
  ) : null;

  const cardClass = reserved ? 'book-card book-card--reserved' : 'book-card';
  const actionsNode = reserved ? reserved.actions : actions;

  return (
    <li className={cardClass}>
      <div className="book-card-row">
        <Link to={href} state={linkState} className="book-card-cover-wrap">
          <BookCoverThumb
            title={book.title}
            isbn={book.isbn}
            coverPath={book.coverPath}
            size={52}
          />
          {!reserved && coverBadge && (
            <span className="book-card-cover-badge">{coverBadge}</span>
          )}
        </Link>
        <div className="book-card-body">
          {titleArea}
          {extraNode}
        </div>
        {actionsNode && <div className="book-card-actions">{actionsNode}</div>}
      </div>
    </li>
  );
}

function ReservedMeta({
  expiresAt,
  badgeLabel,
  pointName,
  pointId,
  pointAddress,
}: {
  expiresAt: string;
  badgeLabel?: string;
  pointName?: string | null;
  pointId?: string | null;
  pointAddress?: string | null;
}) {
  const now = useNowTicker(30_000);
  const msLeft = new Date(expiresAt).getTime() - now;
  const label = badgeLabel ?? 'PRENOTATO';
  return (
    <div className="book-card-reserved-meta">
      <span className="book-card-reserved-badge">{label}</span>
      <span className="book-card-reserved-countdown">{formatCountdown(msLeft)}</span>
      {(pointName || pointAddress) && (
        <span className="book-card-reserved-where">
          {pointName &&
            (pointId ? (
              <Link to={`/punto/${pointId}`} className="book-card-reserved-pointlink">
                {pointName}
              </Link>
            ) : (
              <strong>{pointName}</strong>
            ))}
          {pointAddress && <span className="book-card-reserved-address">{pointAddress}</span>}
        </span>
      )}
    </div>
  );
}
