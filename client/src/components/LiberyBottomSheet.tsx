import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export type LiberyBottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Titolo sintetico per screen reader (`aria-label`). */
  title: string;
  /** Contenuto area scrollabile */
  children: ReactNode;
  /** Classe extra sul pannello (es. `libery-bottom-sheet-panel--preview` = 60% altezza). */
  panelClass?: string;
};

const PANEL_MS = 280;
const DISMISS_DRAG_PX = 80;

type PanelAnim = 'off' | 'open' | 'leaving';

/**
 * Bottom sheet modale (native `<dialog>`).
 *
 * Animazione via @keyframes: la `backwards fill` assicura che il pannello
 * parta sempre da translateY(100%) prima della prima paint, senza alcun
 * trucco di timing JS (RAF, setTimeout, forceReflow).
 *
 * Chiusura: scrim, Escape, swipe giù.
 */
export default function LiberyBottomSheet({
  open,
  onOpenChange,
  title,
  children,
  panelClass,
}: LiberyBottomSheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragYRef = useRef(0);
  const draggingRef = useRef(false);
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const [scrimVisible, setScrimVisible] = useState(false);
  const [panelAnim, setPanelAnim] = useState<PanelAnim>('off');

  useFocusTrap(panelRef, open || panelAnim !== 'off');

  // Gestione chiusura nativa (tasto Escape, el.close() da codice esterno)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function onNativeClose() {
      onOpenChangeRef.current(false);
      setScrimVisible(false);
      setPanelAnim('off');
    }
    el.addEventListener('close', onNativeClose);
    return () => el.removeEventListener('close', onNativeClose);
  }, []);

  /**
   * Apertura: useLayoutEffect → si esegue PRIMA della paint.
   * Così il browser vede il pannello già con la classe --open
   * (che grazie a `animation-fill-mode: backwards` parte da translateY(100%))
   * nella stessa paint in cui il dialog diventa visibile.
   * Nessun "salto" perché non c'è mai un frame senza animazione attiva.
   */
  useLayoutEffect(() => {
    if (!open) return;
    const el = ref.current;
    if (el && !el.open) void el.showModal();
    setScrimVisible(true);
    setPanelAnim('open');
  }, [open]);

  /**
   * Chiusura: useEffect → si esegue dopo la paint (va bene, stiamo
   * avviando l'animazione di uscita, non l'ingresso).
   */
  useEffect(() => {
    if (open) return;
    const el = ref.current;
    setScrimVisible(false);
    if (!el?.open) {
      setPanelAnim('off');
      return;
    }
    setPanelAnim('leaving');
    const timer = window.setTimeout(() => {
      setPanelAnim('off');
      if (el.open) el.close();
    }, PANEL_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  function requestClose() {
    if (!open) return;
    onOpenChange(false);
  }

  function dismissFromBackdrop(e: React.MouseEvent) {
    if (e.target !== e.currentTarget) return;
    e.preventDefault();
    e.stopPropagation();
    requestClose();
  }

  function onHandlePointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    draggingRef.current = true;
    dragYRef.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onHandlePointerMove(e: React.PointerEvent) {
    if (!draggingRef.current || !panelRef.current) return;
    const dy = Math.max(0, e.clientY - dragYRef.current);
    // Lo stile inline sovrascrive l'animation fill — nessun conflitto
    panelRef.current.style.transform = `translateY(${dy}px)`;
  }

  function onHandlePointerUp(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const dy = Math.max(0, e.clientY - dragYRef.current);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    // Rimuovi lo stile inline — il pannello torna alla posizione dell'animation fill
    if (panelRef.current) panelRef.current.style.removeProperty('transform');
    if (dy >= DISMISS_DRAG_PX) requestClose();
  }

  if (!open && panelAnim === 'off') return null;

  return (
    <dialog
      ref={ref}
      className={['libery-bottom-sheet-dlg', scrimVisible ? 'libery-bottom-sheet-dlg--open' : '']
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
            panelAnim === 'open' ? 'libery-bottom-sheet-panel--open' : '',
            panelAnim === 'leaving' ? 'libery-bottom-sheet-panel--leaving' : '',
            'libery-material-surface',
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
          <div className="libery-bottom-sheet-scroll">{children}</div>
        </div>
      </div>
    </dialog>
  );
}
