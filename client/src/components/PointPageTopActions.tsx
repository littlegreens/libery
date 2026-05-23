import { useEffect, useId, useRef, useState } from 'react';
import { MdIcon, MdIconButton } from '@/lib/material/md-react';
import { pointHelpForType } from '@/lib/pointHelp';
import { slotChipDisplay } from '@/lib/slotsDisplay';
import { shareLiberyLink } from '@/lib/share';
import { useCloseOnScroll } from '@/lib/useCloseOnScroll';
import { POINT_TYPE_LABELS } from '@/lib/mapIcons';
import type { PointType } from '@/types/point';

type SlotSummary = {
  libriOggi: number;
  libriExtra: number;
  libriTotali: number;
  activeReservations: number;
  slotsFree: number;
};

type Props = {
  pointId: string;
  pointName: string;
  pointType: PointType;
  mapsHref: string;
  canNavigate: boolean;
  showSlots?: boolean;
  slotsSummary?: SlotSummary | null;
};

/** Condividi, mappa e pannello info (testo guida + slot) nella barra contestuale del punto. */
export default function PointPageTopActions({
  pointId,
  pointName,
  pointType,
  mapsHref,
  canNavigate,
  showSlots,
  slotsSummary,
}: Props) {
  const uid = useId().replace(/:/g, '');
  const infoAnchorId = `point-info-${uid}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [infoOpen, setInfoOpen] = useState(false);

  const help = pointHelpForType(pointType);
  const hasHelp = help.lines.length > 0;
  const slotsFree = slotsSummary?.slotsFree ?? 0;
  const showInfoPanel = hasHelp || showSlots;

  useCloseOnScroll(infoOpen, () => setInfoOpen(false), rootRef);

  useEffect(() => {
    if (!infoOpen) return;
    function onDocPointer(ev: PointerEvent) {
      const t = ev.target as Node;
      if (rootRef.current?.contains(t)) return;
      setInfoOpen(false);
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') setInfoOpen(false);
    }
    document.addEventListener('pointerdown', onDocPointer, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDocPointer, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [infoOpen]);

  return (
    <div ref={rootRef} className="libery-contextual-top-bar__trailing-actions point-top-actions">
      <MdIconButton
        type="button"
        color="standard"
        aria-label="Condividi"
        onClick={() =>
          void shareLiberyLink({
            path: `/punto/${pointId}`,
            title: pointName,
            text: POINT_TYPE_LABELS[pointType],
          })
        }
      >
        <MdIcon>share</MdIcon>
      </MdIconButton>
      <MdIconButton
        type="button"
        color="standard"
        aria-label="Apri navigazione"
        disabled={!canNavigate}
        onClick={() => window.open(mapsHref, '_blank', 'noopener,noreferrer')}
      >
        <MdIcon>assistant_navigation</MdIcon>
      </MdIconButton>
      {showInfoPanel ? (
        <div className="point-top-actions__info-wrap">
          <MdIconButton
            id={infoAnchorId}
            type="button"
            color="standard"
            className={infoOpen ? 'point-top-actions__info-btn--open' : ''}
            aria-label="Informazioni su questo punto"
            aria-expanded={infoOpen}
            aria-controls={infoOpen ? `point-info-panel-${uid}` : undefined}
            onClick={() => setInfoOpen((o) => !o)}
          >
            <MdIcon>info</MdIcon>
          </MdIconButton>
          {infoOpen ? (
            <div
              ref={popoverRef}
              id={`point-info-panel-${uid}`}
              className="point-info-popover"
              role="dialog"
              aria-label="Informazioni punto"
            >
              {showSlots && slotsSummary ? (
                <section className="point-info-popover__section">
                  <h2 className="point-info-popover__title">I tuoi slot</h2>
                  <p className="point-info-popover__text">
                    Puoi prendere o prenotare:{' '}
                    <strong>{slotChipDisplay(slotsFree)}</strong>
                    {slotsSummary.activeReservations > 0 ? (
                      <>
                        {' '}
                        ·{' '}
                        {slotsSummary.activeReservations === 1
                          ? '1 prenotazione attiva'
                          : `${slotsSummary.activeReservations} prenotazioni attive`}
                      </>
                    ) : null}
                  </p>
                </section>
              ) : null}
              {hasHelp ? (
                <section className="point-info-popover__section">
                  <h2 className="point-info-popover__title">{help.title}</h2>
                  <ul className="point-info-popover__list">
                    {help.lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
