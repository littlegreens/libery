import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export type ToastItem = {
  id: string;
  variant: ToastVariant;
  title?: string;
  message: string;
  /** Auto-dismiss in ms. Default: ~4s (snackbar). Imposta 0 per messaggio fisso fino alla chiusura manuale. */
  duration: number;
};

type ToastState = {
  toasts: ToastItem[];
  push: (t: Omit<ToastItem, 'id' | 'duration'> & { duration?: number }) => string;
  dismiss: (id: string) => void;
  clear: () => void;
};

/** Durata tipo snackbar MD (chiusura gestita da `ToastContainer`). */
const DEFAULT_DURATION = 4000;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  push: (t) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const item: ToastItem = {
      id,
      variant: t.variant,
      title: t.title,
      message: t.message,
      duration: t.duration ?? DEFAULT_DURATION,
    };
    set((s) => ({ toasts: [...s.toasts, item] }));
    return id;
  },

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

/**
 * Helper imperativi importabili da qualunque file (anche fuori da React).
 *
 * Esempi:
 *   toast.success('Libro prenotato!')
 *   toast.error('Token scaduto', { title: 'Errore di rete' })
 *   toast.info('Caricamento dati', { duration: 0 }) // persistente
 */
export const toast = {
  success: (message: string, opts?: { title?: string; duration?: number }) =>
    useToastStore.getState().push({ variant: 'success', message, ...opts }),
  error: (message: string, opts?: { title?: string; duration?: number }) =>
    useToastStore.getState().push({ variant: 'error', message, ...opts }),
  warning: (message: string, opts?: { title?: string; duration?: number }) =>
    useToastStore.getState().push({ variant: 'warning', message, ...opts }),
  info: (message: string, opts?: { title?: string; duration?: number }) =>
    useToastStore.getState().push({ variant: 'info', message, ...opts }),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
};
