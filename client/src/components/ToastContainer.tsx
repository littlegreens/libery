import { useEffect } from 'react';
import type { ToastItem, ToastVariant } from '@/stores/toastStore';
import { useToastStore } from '@/stores/toastStore';

const TOAST_ICONS: Record<ToastVariant, string> = {
  success: 'check_circle',
  error: 'error',
  warning: 'warning',
  info: 'info',
};

/** Testo sintetico in una riga (linee guida snackbar Material). */
function snackbarBody(t: ToastItem): string {
  const raw = [t.title, t.message].filter(Boolean).join(' · ');
  const max = 130;
  if (raw.length <= max) return raw;
  return `${raw.slice(0, Math.max(0, max - 1))}…`;
}

/** Singolo snackbar in basso, coda sequenziale sul primo elemento dell’array. */
export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  const active = toasts[0] ?? null;

  useEffect(() => {
    if (!active) return;
    if (active.duration <= 0) return;
    const id = active.id;
    const ms = Math.max(active.duration, 1500);
    const tmr = window.setTimeout(() => dismiss(id), ms);
    return () => window.clearTimeout(tmr);
  }, [active?.id, active?.duration, dismiss]);

  if (!active) return null;

  return (
    <div
      className="libery-snackbar-host"
      role={active.variant === 'error' ? 'alert' : 'status'}
      aria-live={active.variant === 'error' ? 'assertive' : 'polite'}
      aria-relevant="additions text"
    >
      <div className={`libery-snackbar libery-snackbar--${active.variant}`}>
        <md-icon className="libery-snackbar-leading-icon" aria-hidden>
          {TOAST_ICONS[active.variant]}
        </md-icon>
        <span className="libery-snackbar-text">{snackbarBody(active)}</span>
        {active.duration <= 0 ? (
          <button type="button" className="libery-snackbar-close" aria-label="Chiudi" onClick={() => dismiss(active.id)}>
            <span aria-hidden>×</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
