/** Spazio tra punta del pin e card popup (px). */
export const POPUP_GAP_PX = 8;

/** Pin base 42px → selezionato 52px (CSS). */
const PIN_ACTIVE_EXTRA_H = 10;

/**
 * Offset aggiuntivo Leaflet `popup.options.offset` (solo compensazione pin attivo).
 * La distanza base è già in `popupAnchor` dell'icona.
 */
export function pinPopupOffsetY(active = false): number {
  return active ? PIN_ACTIVE_EXTRA_H : 0;
}
