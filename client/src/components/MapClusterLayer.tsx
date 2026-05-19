import { useEffect, useMemo, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import {
  createClusterDivIcon,
  dominantPointType,
  getPointIcon,
} from '@/lib/mapIcons';
import type { MapPoint, PointType } from '@/types/point';

type Props = {
  points: MapPoint[];
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatAddress(p: MapPoint): string {
  const parts = [p.address, p.city].filter((s): s is string => Boolean(s?.trim()));
  return parts.join(', ');
}

export default function MapClusterLayer({ points }: Props) {
  const map = useMap();
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const typeByMarkerRef = useRef<WeakMap<L.Marker, PointType>>(new WeakMap());

  const geoPoints = useMemo(
    () => points.filter((p) => p.latitude != null && p.longitude != null),
    [points],
  );

  useEffect(() => {
    const typeByMarker = typeByMarkerRef.current;

    if (!clusterRef.current) {
      clusterRef.current = L.markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        spiderfyDistanceMultiplier: 1.4,
        zoomToBoundsOnClick: true,
        maxClusterRadius: 42,
        disableClusteringAtZoom: 17,
        animate: true,
        animateAddingMarkers: false,
        iconCreateFunction: (cluster) => {
          const markers = cluster.getAllChildMarkers();
          const counts: Record<PointType, number> = {
            biblioteca: 0,
            libreria: 0,
            corner_free: 0,
          };
          for (const m of markers) {
            const t = typeByMarker.get(m);
            if (t) counts[t]++;
          }
          const dominant = dominantPointType(counts);
          return createClusterDivIcon(cluster.getChildCount(), dominant);
        },
      });
      map.addLayer(clusterRef.current);
    }

    const cluster = clusterRef.current;
    cluster.clearLayers();

    for (const p of geoPoints) {
      const marker = L.marker([p.latitude!, p.longitude!], {
        icon: getPointIcon(p.type),
      });
      typeByMarker.set(marker, p.type);

      const addressLine = formatAddress(p);
      const addressHtml = addressLine
        ? `<span class="map-popup-address">${escapeHtml(addressLine)}</span>`
        : '';

      marker.bindPopup(
        `<div class="map-popup-inner">
          <strong class="map-popup-title">${escapeHtml(p.name)}</strong>
          ${addressHtml}
          <a href="/punto/${p.id}" class="map-popup-link">Apri scheda</a>
        </div>`,
        { maxWidth: 260 },
      );

      marker.on('popupopen', () => {
        marker.getElement()?.classList.add('map-pin-active');
      });
      marker.on('popupclose', () => {
        marker.getElement()?.classList.remove('map-pin-active');
      });

      cluster.addLayer(marker);
    }

    if (geoPoints.length > 0) {
      cluster.refreshClusters();
      window.setTimeout(() => map.invalidateSize({ animate: false }), 0);
    }

    return () => {
      cluster.clearLayers();
    };
  }, [map, geoPoints]);

  useEffect(() => {
    return () => {
      if (clusterRef.current) {
        map.removeLayer(clusterRef.current);
        clusterRef.current = null;
      }
    };
  }, [map]);

  return null;
}
