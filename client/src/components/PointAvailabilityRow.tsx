import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import PointTypeBadge from '@/components/PointTypeBadge';
import { formatDistanceKm } from '@/lib/geo';
import type { PointType } from '@/types/point';

export type PointAvailabilityRowData = {
  pointId: string;
  pointName: string;
  type: PointType;
  copies: number;
  address?: string | null;
  city?: string | null;
  photoUrl?: string | null;
  km?: number | null;
};

type Props = {
  row: PointAvailabilityRowData;
  isLast?: boolean;
  linkState?: unknown;
  onSelect?: () => void;
};

function RowBody({ row }: { row: PointAvailabilityRowData }) {
  const addressLine = [row.address, row.city].filter(Boolean).join(', ');
  return (
    <div className="libery-point-avail-row__content">
      <div className="libery-point-avail-row__badge">
        <PointTypeBadge type={row.type} size="medium" className="flush" />
      </div>
      <p className="libery-point-avail-row__title">{row.pointName}</p>
      {addressLine ? <p className="libery-point-avail-row__addr">{addressLine}</p> : null}
        {(row.km != null || row.copies > 0) && (
          <div className="libery-point-avail-row__foot">
            {row.km != null ? (
              <div className="libery-point-avail-row__distance">
                <span className="libery-point-avail-row__distance-label">distanza</span>
                <span className="libery-point-avail-row__distance-value">{formatDistanceKm(row.km)}</span>
              </div>
            ) : (
              <span className="libery-point-avail-row__foot-spacer" aria-hidden />
            )}
            {row.copies > 0 ? (
              <p className="libery-point-avail-row__copies-line">
                numero copie: <span className="libery-point-avail-row__copies-n">{row.copies}</span>
              </p>
            ) : null}
          </div>
        )}
    </div>
  );
}

function RowShell({
  children,
  isLast,
  onClick,
}: {
  children: ReactNode;
  isLast?: boolean;
  onClick?: () => void;
}) {
  const bordered = !isLast ? ' libery-point-avail-row--bordered' : '';
  if (onClick) {
    return (
      <article className={`libery-point-avail-row${bordered}`}>
        <button type="button" className="libery-point-avail-row__main" onClick={onClick}>
          {children}
        </button>
      </article>
    );
  }
  return <article className={`libery-point-avail-row${bordered}`}>{children}</article>;
}

/** Riga «più vicino»: badge tipo sopra il titolo (senza icona punto). */
export default function PointAvailabilityRow({ row, isLast, linkState, onSelect }: Props) {
  const inner = <RowBody row={row} />;

  if (onSelect) {
    return (
      <RowShell isLast={isLast} onClick={onSelect}>
        {inner}
      </RowShell>
    );
  }

  return (
    <RowShell isLast={isLast}>
      <Link to={`/punto/${row.pointId}`} state={linkState} className="libery-point-avail-row__main">
        {inner}
      </Link>
    </RowShell>
  );
}
