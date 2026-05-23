import axios from 'axios';

/**
 * Estrae il messaggio d'errore da una risposta Axios.
 * Usa il campo `error` del body JSON oppure un fallback generico.
 */
export function getApiError(err: unknown, fallback = 'Qualcosa è andato storto'): string {
  if (axios.isAxiosError(err)) {
    const msg = (err.response?.data as { error?: string } | undefined)?.error;
    if (msg) return msg;
    if (err.code === 'ERR_NETWORK' || !err.response) return 'Nessuna connessione';
    if (err.response.status >= 500) return 'Servizio non disponibile';
  }
  return fallback;
}
