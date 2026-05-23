import { formatDistanceKm, haversineKm } from '@/lib/geo';
import type { BookAvailability } from '@/types/book';

export type AvailabilityWithDistance = BookAvailability & { km: number | null };

/** Ordina per distanza crescente quando la posizione è nota; altrimenti per nome punto. */
export function sortAvailabilityByDistance(
  availability: BookAvailability[],
  userPos: { lat: number; lng: number } | null | undefined,
): AvailabilityWithDistance[] {
  return availability
    .map((a) => ({
      ...a,
      km:
        userPos && a.latitude != null && a.longitude != null
          ? haversineKm(userPos.lat, userPos.lng, a.latitude, a.longitude)
          : null,
    }))
    .sort((a, b) => {
      if (a.km != null && b.km != null) return a.km - b.km;
      if (a.km != null) return -1;
      if (b.km != null) return 1;
      return a.pointName.localeCompare(b.pointName, 'it');
    });
}

export function formatKmLabel(km: number | null): string | null {
  if (km == null) return null;
  return formatDistanceKm(km);
}
