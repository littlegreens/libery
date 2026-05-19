/** Raggio GPS per prendi / lascia: devi essere nel punto (pochi metri). */
export const NEAR_POINT_METERS = 50;
export const NEAR_POINT_KM = NEAR_POINT_METERS / 1000;

/** Testo per UI: «entro 50 m» */
export function nearPointRadiusLabel(): string {
  return `${NEAR_POINT_METERS} m`;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistanceKm(km: number): string {
  if (km < 0.001) return 'qui';
  if (km < 1) {
    const m = Math.round(km * 1000);
    return m < 1 ? '< 1 m' : `${m} m`;
  }
  return `${km.toFixed(1)} km`;
}
