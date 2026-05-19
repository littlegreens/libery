import { useToastStore, type ToastVariant } from '@/stores/toastStore';

const VARIANT_ICONS: Record<ToastVariant, JSX.Element> = {
  success: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="M22 4 12 14.01l-3-3" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M15 9l-6 6" />
      <path d="M9 9l6 6" />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  ),
};

/**
 * Container globale dei toast.
 * Va montato una sola volta a livello di shell. I toast sono pilotati dallo
 * store `useToastStore` (o dagli helper `toast.success/error/...`).
 *
 * Stile: Bootstrap-like, posizionato top-right (in alto a destra), 3s auto-dismiss.
 */
export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="libery-toast-container" role="region" aria-live="polite" aria-label="Notifiche">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`libery-toast libery-toast--${t.variant}`}
          role={t.variant === 'error' ? 'alert' : 'status'}
        >
          <span className="libery-toast-icon">{VARIANT_ICONS[t.variant]}</span>
          <div className="libery-toast-body">
            {t.title && <div className="libery-toast-title">{t.title}</div>}
            <div className="libery-toast-message">{t.message}</div>
          </div>
          <button
            type="button"
            className="libery-toast-close"
            aria-label="Chiudi"
            onClick={() => dismiss(t.id)}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 6 6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
