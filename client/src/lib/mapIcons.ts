import L from 'leaflet';
import { mapPins } from '@/lib/assets';
import type { PointType } from '@/types/point';

/** Pin 36×42px — anchor sulla punta (`public/map/pins/*.svg`) */
const PIN_W = 36;
const PIN_H = 42;

function pinIcon(iconUrl: string): L.Icon {
  return L.icon({
    iconUrl,
    iconSize: [PIN_W, PIN_H],
    iconAnchor: [PIN_W / 2, PIN_H],
    popupAnchor: [0, -PIN_H + 4],
  });
}

const icons: Record<PointType, L.Icon> = {
  biblioteca: pinIcon(mapPins.biblioteca),
  libreria: pinIcon(mapPins.libreria),
  corner_free: pinIcon(mapPins.corner_free),
};

export function getPointIcon(type: PointType): L.Icon {
  return icons[type];
}

export const userLocationIcon = L.divIcon({
  className: 'user-location-marker',
  html: '<span class="user-location-dot"></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export const POINT_TYPE_LABELS: Record<PointType, string> = {
  biblioteca: 'Biblioteca',
  libreria: 'Libreria',
  corner_free: 'Corner Free',
};

export const POINT_TYPE_CLUSTER_COLORS: Record<PointType, { fill: string; ring: string }> = {
  biblioteca: { fill: '#4a6a8a', ring: 'rgba(74, 106, 138, 0.35)' },
  libreria: { fill: '#3d6b4a', ring: 'rgba(61, 107, 74, 0.35)' },
  corner_free: { fill: '#b35a20', ring: 'rgba(179, 90, 32, 0.35)' },
};

export const CLUSTER_SIZE = 34;

export function dominantPointType(counts: Record<PointType, number>): PointType {
  let best: PointType = 'biblioteca';
  let max = -1;
  (Object.keys(counts) as PointType[]).forEach((t) => {
    if (counts[t] > max) {
      max = counts[t];
      best = t;
    }
  });
  return best;
}

export function createClusterDivIcon(count: number, dominant: PointType): L.DivIcon {
  return L.divIcon({
    html: `<div class="libery-cluster-marker libery-cluster-marker--${dominant}" aria-hidden="true">${count}</div>`,
    className: 'libery-cluster-icon',
    iconSize: L.point(CLUSTER_SIZE, CLUSTER_SIZE),
    iconAnchor: L.point(CLUSTER_SIZE / 2, CLUSTER_SIZE / 2),
  });
}
