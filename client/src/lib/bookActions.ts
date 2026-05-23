/** Etichette e icone Material condivise per azioni sui libri. */

export const BOOK_ACTION_ICONS = {
  favorite: 'favorite',
  favoriteOutline: 'favorite_border',
  eliminaPreferiti: 'heart_minus',
  ricevi: 'add_circle',
  prenota: 'nest_clock_farsight_analog',
  lascia: 'change_circle',
  annullaPrenotazione: 'remove_circle',
  nonCePiu: 'highlight_off',
} as const;

export const BOOK_ACTION_LABELS = {
  preferito: 'Preferito',
  eliminaPreferiti: 'Elimina dai preferiti',
  ricevi: 'Ricevi',
  ritira: 'Ritiralo',
  prenota: 'Prenota',
  annullaPrenotazione: 'Annulla prenotazione',
  dona: 'Dona',
  nonCePiu: 'Non c\'è più',
} as const;
