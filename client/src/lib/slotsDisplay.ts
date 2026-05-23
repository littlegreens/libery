/** Valore compatto per badge avatar (max una cifra + eventuale «+»). */
export function avatarSlotBadgeValue(slotsFree: number): string {
  if (slotsFree >= 10) return '9+';
  return String(Math.max(0, slotsFree));
}

/** Etichetta chip profilo / UI. */
export function slotChipDisplay(slotsFree: number): number | string {
  return avatarSlotBadgeValue(slotsFree);
}
