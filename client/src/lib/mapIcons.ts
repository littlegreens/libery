import L from 'leaflet';
import { icons as appIcons, mapPins } from '@/lib/assets';
import { POPUP_GAP_PX } from '@/lib/mapPinLayout';
import type { PointType } from '@/types/point';

/** Pin 36×42px — anchor sulla punta (`public/map/pins/*.svg`) */
export const PIN_W = 36;
export const PIN_H = 42;
/** Pin selezionato 45×52px (CSS). */
export const PIN_ACTIVE_W = 45;
export const PIN_ACTIVE_H = 52;
/** Scala pin selezionata (+25%). */
export const PIN_ACTIVE_SCALE = 0.25;

function pinIcon(iconUrl: string): L.Icon {
  return L.icon({
    iconUrl,
    iconSize: [PIN_W, PIN_H],
    iconAnchor: [PIN_W / 2, PIN_H],
    popupAnchor: [0, -(PIN_H + POPUP_GAP_PX)],
    className: 'libery-map-pin',
  });
}

const pointIcons: Record<PointType, L.Icon> = {
  biblioteca: pinIcon(mapPins.biblioteca),
  libreria: pinIcon(mapPins.libreria),
  corner_free: pinIcon(mapPins.corner_free),
};

export function getPointIcon(type: PointType): L.Icon {
  return pointIcons[type];
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

/** Hero scheda punto senza foto: sfondo + icona per tipo. */
export const POINT_TYPE_HERO: Record<PointType, { fill: string; iconSrc: string }> = {
  biblioteca: { fill: POINT_TYPE_CLUSTER_COLORS.biblioteca.fill, iconSrc: appIcons.book },
  libreria: { fill: POINT_TYPE_CLUSTER_COLORS.libreria.fill, iconSrc: appIcons.libreria },
  corner_free: { fill: POINT_TYPE_CLUSTER_COLORS.corner_free.fill, iconSrc: appIcons.corner },
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
