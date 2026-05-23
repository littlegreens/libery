import { useEffect, useRef } from 'react';
import PointTypeBadge from '@/components/PointTypeBadge';
import { LiberyButton, MdIcon, MdIconButton } from '@/lib/material/md-react';
import type { MapPoint } from '@/types/point';

type Props = {
  point: MapPoint;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Info punto (per ora: tipo, orari, istruzioni uso — da arricchire). */
export default function PointInfoDialog({ point, open, onOpenChange }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const opening = point.openingHours as Record<string, string> | null | undefined;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="libery-point-info-dlg"
      aria-labelledby="point-info-title"
      onClose={() => onOpenChange(false)}
    >
      <div className="libery-point-info-dlg__header">
        <h2 id="point-info-title" className="libery-point-info-dlg__title">
          Informazioni
        </h2>
        <MdIconButton
          type="button"
          color="standard"
          aria-label="Chiudi"
          onClick={() => onOpenChange(false)}
        >
          <MdIcon>close</MdIcon>
        </MdIconButton>
      </div>
      <div className="libery-point-info-dlg__body">
        <PointTypeBadge type={point.type} />
        {point.description ? <p className="mb-3">{point.description}</p> : null}
        {opening ? (
          <div className="mb-3">
            <strong className="d-block mb-1">Orari</strong>
            <ul className="list-unstyled mb-0 small text-muted">
              {Object.entries(opening).map(([day, hours]) => (
                <li key={day}>
                  <span className="text-capitalize">{day}</span>: {hours}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="small text-muted mb-0">
          {(point.type === 'biblioteca' || point.type === 'libreria') ? (
            <>
              <strong>Prenota</strong> da casa (nessun QR). In sede, su un libro prenotato:{' '}
              <strong>Ritiralo</strong> e mostra il QR all&apos;addetto. Per donare un volume usa la
              fotocamera → <strong>Dona</strong>.
            </>
          ) : (
            <>
              <strong>Ricevi</strong> dalla lista (GPS + ISBN). Libro assente? Segnala dal menu. Per
              donare: fotocamera → <strong>Dona</strong>.
            </>
          )}
        </p>
      </div>
      <LiberyButton type="button" color="filled" className="w-100 mt-3" onClick={() => onOpenChange(false)}>
        Chiudi
      </LiberyButton>
    </dialog>
  );
}
