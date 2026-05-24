/**
 * Bottom sheet modale unificato (libri, QR, auth).
 * Non modificare senza test su: BookSearchBottomSheet, UserPickupQrSheet,
 * UserLeaveQrSheet, AuthBottomSheet.
 */
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export type LiberyBottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Titolo per screen reader (`aria-label` sul dialog). */
  title: string;
  /** Contenuto area scrollabile. */
  children: ReactNode;
  /** Classe extra sul pannello (es. `--preview`, `--qr`, `--auth`). */
  panelClass?: string;
  /** Titolo visibile sopra il contenuto (opzionale, es. login). */
  heading?: ReactNode;
};

const PANEL_MS = 260;
const SNAP_MS = 220;
const DISMISS_DRAG_PX = 72;

type PanelPhase = 'closed' | 'entering' | 'open' | 'leaving';

export default function LiberyBottomSheet({
  open,
  onOpenChange,
  title,
  children,
  panelClass,
  heading,
}: LiberyBottomSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartYRef = useRef(0);
  const dragDyRef = useRef(0);
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const [mounted, setMounted] = useState(open);
  const [phase, setPhase] = useState<PanelPhase>(open ? 'entering' : 'closed');
  const [scrimOn, setScrimOn] = useState(open);
  const [dragging, setDragging] = useState(false);
  const [snapping, setSnapping] = useState(false);

  const isInteractive = mounted && phase !== 'closed';

  useBodyScrollLock(isInteractive);
  useFocusTrap(panelRef, isInteractive);

  const requestClose = useCallback(() => {
    onOpenChangeRef.current(false);
  }, []);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    function onNativeClose() {
      onOpenChangeRef.current(false);
      setMounted(false);
      setPhase('closed');
      setScrimOn(false);
      setDragging(false);
      setSnapping(false);
    }
    el.addEventListener('close', onNativeClose);
    return () => el.removeEventListener('close', onNativeClose);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const dlg = dialogRef.current;
    if (dlg && !dlg.open) dlg.showModal();
    setMounted(true);
    setScrimOn(true);
    setPhase('entering');
    const id = requestAnimationFrame(() => setPhase('open'));
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (open) return;
    if (!mounted) return;
    setScrimOn(false);
    setPhase('leaving');
    const timer = window.setTimeout(() => {
      const dlg = dialogRef.current;
      if (dlg?.open) dlg.close();
      setMounted(false);
      setPhase('closed');
      setDragging(false);
      setSnapping(false);
      if (panelRef.current) panelRef.current.style.removeProperty('transform');
    }, PANEL_MS);
    return () => window.clearTimeout(timer);
  }, [open, mounted]);

  function clearDragStyle() {
    const panel = panelRef.current;
    if (!panel) return;
    panel.style.removeProperty('transform');
    setDragging(false);
    setSnapping(false);
  }

  function onHandlePointerDown(e: React.PointerEvent) {
    if (e.button !== 0 || phase === 'leaving') return;
    dragStartYRef.current = e.clientY;
    dragDyRef.current = 0;
    setDragging(true);
    setSnapping(false);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onHandlePointerMove(e: React.PointerEvent) {
    if (!dragging || !panelRef.current) return;
    const dy = Math.max(0, e.clientY - dragStartYRef.current);
    dragDyRef.current = dy;
    panelRef.current.style.transform = `translateY(${dy}px)`;
  }

  function onHandlePointerUp(e: React.PointerEvent) {
    if (!dragging) return;
    const dy = dragDyRef.current;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (dy >= DISMISS_DRAG_PX) {
      clearDragStyle();
      requestClose();
      return;
    }

    if (dy > 6 && panelRef.current) {
      setSnapping(true);
      panelRef.current.style.transform = 'translateY(0)';
      window.setTimeout(clearDragStyle, SNAP_MS);
      return;
    }

    clearDragStyle();
  }

  function dismissFromBackdrop(e: React.MouseEvent) {
    if (e.target !== e.currentTarget) return;
    e.preventDefault();
    requestClose();
  }

  if (!mounted && !open) return null;

  return (
    <dialog
      ref={dialogRef}
      className={[
        'libery-bottom-sheet-dlg',
        scrimOn ? 'libery-bottom-sheet-dlg--open' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-modal="true"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
    >
      <div
        className="libery-bottom-sheet-layout"
        role="presentation"
        onMouseDown={dismissFromBackdrop}
      >
        <div
          ref={panelRef}
          className={[
            'libery-bottom-sheet-panel',
            'libery-material-surface',
            phase === 'open' ? 'libery-bottom-sheet-panel--open' : '',
            phase === 'leaving' ? 'libery-bottom-sheet-panel--leaving' : '',
            dragging ? 'libery-bottom-sheet-panel--dragging' : '',
            snapping ? 'libery-bottom-sheet-panel--snap-back' : '',
            panelClass,
          ]
            .filter(Boolean)
            .join(' ')}
          role="document"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div
            className="libery-bottom-sheet-top"
            onPointerDown={onHandlePointerDown}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerUp}
            onPointerCancel={onHandlePointerUp}
          >
            <div className="libery-bottom-sheet-handle" aria-hidden />
          </div>
          {heading ? <div className="libery-bottom-sheet-heading-wrap">{heading}</div> : null}
          <div className="libery-bottom-sheet-scroll">{children}</div>
        </div>
      </div>
    </dialog>
  );
}
