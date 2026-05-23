import { toast } from '@/stores/toastStore';

/** Avvisi fotocamera / catalogo — messaggi brevi, snackbar nera standard. */
export const cameraAlerts = {
  isbnNotRecognized: () => toast.warning('ISBN non riconosciuto'),
  bookNotFound: () => toast.warning('Libro non trovato'),
  bookNotRecognized: () => toast.warning('Libro non riconosciuto'),
};
