import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import BookCoverThumb from '@/components/BookCoverThumb';
import { LiberyAssistLabelChip } from '@/components/LiberyMaterialChips';
import { MdBadge, MdChip, MdDivider, MdListItem } from '@/lib/material/md-react';

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
  /** Badge sotto la cover (chip assist o `md-badge` se numerico / "N copie"). */
  coverBadge?: ReactNode;
  /** Slot extra sotto titolo/autore (riga non cliccabile: link, testo, ecc.). */
  subtitle?: ReactNode;
  /** Azioni in fondo alla scheda (pulsanti Material). */
  actions?: ReactNode;
  /** `centered`: una sola azione centrata (es. preferiti nel zaino). */
  actionsLayout?: 'default' | 'centered';
  /**
   * Quando presente abilita la variante "prenotato":
   * stesso layout cover+body ma il body contiene badge,
   * countdown e info punto (con eventuale link al punto).
   */
  reserved?: ReservedInfo;
  /** Se false, aggiunge `md-divider` sotto l’ultima riga (separator tra libri in `md-list`). */
  isLast?: boolean;
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
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function CoverAccessory({ coverBadge }: { coverBadge?: ReactNode }) {
  if (coverBadge == null) return null;
  if (typeof coverBadge === 'number' && Number.isFinite(coverBadge)) {
    return <MdBadge value={String(Math.trunc(coverBadge))} />;
  }
  if (typeof coverBadge === 'string') {
    const t = coverBadge.trim();
    const copies = /^(\d+)\s+(copia|copie)$/i.exec(t);
    if (copies) {
      return <MdBadge value={copies[1]} />;
    }
    if (/^\d+$/.test(t)) {
      return <MdBadge value={t} />;
    }
    return <MdChip type="assist" label={t} disabled />;
  }
  return <div className="libery-book-cover-extra">{coverBadge}</div>;
}

export default function BookCard({
  book,
  to,
  linkState,
  coverBadge,
  subtitle,
  actions,
  actionsLayout = 'default',
  reserved,
  isLast = true,
}: Props) {
  const navigate = useNavigate();
  const href = to ?? `/libro/${book.id}`;

  const goToBook = () => {
    navigate(href, { state: linkState });
  };

  const actionsNode = reserved ? reserved.actions : actions;

  const extraNode = reserved ? (
    <ReservedMeta
      expiresAt={reserved.expiresAt}
      badgeLabel={reserved.badgeLabel}
      pointName={reserved.pointName}
      pointId={reserved.pointId}
      pointAddress={reserved.pointAddress}
    />
  ) : (
    subtitle
  );

  const coverStart = (
    <div slot="start" className="libery-book-cover-cell">
      <div className="libery-book-cover-badge-host">
        <BookCoverThumb
          title={book.title}
          isbn={book.isbn}
          coverPath={book.coverPath}
          coverSize="list"
        />
        {!reserved && <CoverAccessory coverBadge={coverBadge} />}
      </div>
    </div>
  );

  return (
    <Fragment>
      <MdListItem type="button" className="libery-book-primary-item" onClick={goToBook}>
        {coverStart}
        <span slot="headline" className="book-title-clamp-2">
          {book.title}
        </span>
        {!reserved && book.author ? (
          <span slot="supporting-text" className="book-card-author book-card-author--in-list">
            {book.author}
          </span>
        ) : null}
      </MdListItem>

      {extraNode ? (
        <MdListItem type="text" className="libery-book-detail-item">
          <div slot="start" className="libery-book-leading-spacer" aria-hidden />
          <div slot="supporting-text" className="libery-book-detail-supporting">
            {extraNode}
          </div>
        </MdListItem>
      ) : null}

      {actionsNode ? (
        <MdListItem
          type="text"
          className={[
            'libery-book-actions-item',
            actionsLayout === 'centered' ? 'libery-book-actions-item--centered' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {actionsLayout !== 'centered' ? (
            <div slot="start" className="libery-book-leading-spacer" aria-hidden />
          ) : null}
          <div
            slot="supporting-text"
            className={[
              'libery-book-actions-row',
              actionsLayout === 'centered' ? 'libery-book-actions-row--centered' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {actionsNode}
          </div>
        </MdListItem>
      ) : null}

      {!isLast ? <MdDivider /> : null}
    </Fragment>
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
      <div className="libery-book-chip-row">
        <LiberyAssistLabelChip label={label} />
      </div>
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
