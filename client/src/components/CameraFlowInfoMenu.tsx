import { useEffect, useId, useRef, useState } from 'react';
import { MdIcon, MdIconButton } from '@/lib/material/md-react';
import { CAMERA_GUIDE_LINES } from '@/lib/pointHelp';
import type { PointType } from '@/types/point';

type Props = {
  pointType?: PointType | string | null;
  variant?: 'default' | 'take' | 'leave';
  phaseHint?: string | null;
  scanHint?: string | null;
  lastError?: string | null;
};

function guideLines(
  pointType: PointType | string | null | undefined,
  variant: 'default' | 'take' | 'leave',
): string[] {
  const certified = pointType === 'biblioteca' || pointType === 'libreria';
  const corner = pointType === 'corner_free';
  const lines: string[] = [CAMERA_GUIDE_LINES.intro];

  if (variant === 'leave') {
    lines.push(certified ? CAMERA_GUIDE_LINES.leaveCertified : CAMERA_GUIDE_LINES.leaveCorner);
  } else if (variant === 'take') {
    lines.push(certified ? CAMERA_GUIDE_LINES.takeCertified : CAMERA_GUIDE_LINES.takeCorner);
  } else if (certified) {
    lines.push(CAMERA_GUIDE_LINES.takeCertified);
    lines.push(CAMERA_GUIDE_LINES.leaveCertified);
  } else if (corner) {
    lines.push(CAMERA_GUIDE_LINES.takeCorner);
    lines.push(CAMERA_GUIDE_LINES.leaveCorner);
  } else {
    lines.push(CAMERA_GUIDE_LINES.scanPreview);
    lines.push(CAMERA_GUIDE_LINES.leaveCertified);
  }

  lines.push('Avvicina il codice, tocca lo schermo per la messa a fuoco; usa la torcia se è poco luce.');
  return lines;
}

/** Menu ℹ nella barra fotocamera: istruzioni e ultimo avviso (niente testo sulla preview). */
export default function CameraFlowInfoMenu({
  pointType,
  variant = 'default',
  phaseHint,
  scanHint,
  lastError,
}: Props) {
  const uid = useId().replace(/:/g, '');
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const lines = guideLines(pointType, variant);

  useEffect(() => {
    if (!open) return;
    function onDocPointer(ev: PointerEvent) {
      const t = ev.target as Node;
      if (rootRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onDocPointer, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDocPointer, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="camera-flow-info-wrap">
      <MdIconButton
        type="button"
        color="standard"
        aria-label="Informazioni fotocamera"
        aria-expanded={open}
        aria-controls={open ? `camera-info-${uid}` : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <MdIcon>info</MdIcon>
      </MdIconButton>
      {open ? (
        <div
          id={`camera-info-${uid}`}
          className="camera-flow-info-popover"
          role="dialog"
          aria-label="Come usare la fotocamera"
        >
          {lastError ? (
            <p className="camera-flow-info-popover__error" role="alert">
              {lastError}
            </p>
          ) : null}
          {phaseHint ? <p className="camera-flow-info-popover__phase">{phaseHint}</p> : null}
          {scanHint ? <p className="camera-flow-info-popover__phase">{scanHint}</p> : null}
          <h2 className="camera-flow-info-popover__title">Come funziona</h2>
          <ul className="camera-flow-info-popover__list">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
