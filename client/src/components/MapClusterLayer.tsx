import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { pinPopupOffsetY } from '@/lib/mapPinLayout';
import { buildMapPopupElement } from '@/lib/mapPopupHtml';
import type { MapPoint, PointType } from '@/types/point';

/**
 * Zoom dal quale spiderfyamo subito senza animazione fly.
 * Non usiamo disableClusteringAtZoom: a zoom elevati i punti sparsi
 * smettono di clustrarsi naturalmente (maxClusterRadius → 1px),
 * ma i punti sovrapposti restano sempre cluster e si aprono con spiderfy.
 */
const MAX_CLUSTER_ZOOM = 17;
const CLUSTER_FLY_PADDING: L.PointExpression = [60, 60];

/** Raggio cluster in pixel, funzione dello zoom.
 *  Sotto il 16: 36px (comportamento normale).
 *  Dal 16 in su: 1px → solo punti praticamente sovrapposti si clusterano. */
function clusterRadius(zoom: number): number {
  return zoom >= 16 ? 1 : 36;
}

type Props = {
  points: MapPoint[];
};

function syncMarkerPopupOffset(marker: L.Marker) {
  const popup = marker.getPopup();
  if (!popup) return;
  const active = marker.getElement()?.classList.contains('map-pin-active') ?? false;
  const extra = pinPopupOffsetY(active);
  popup.options.offset = extra > 0 ? L.point(0, -extra) : L.point(0, 0);
  if (popup.isOpen()) popup.update();
}

/** Pin praticamente sullo stesso punto (~15 m) */
function boundsAreDegenerate(bounds: L.LatLngBounds): boolean {
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  return Math.abs(ne.lat - sw.lat) < 0.00015 && Math.abs(ne.lng - sw.lng) < 0.00015;
}

function handleClusterClick(map: L.Map, cluster: L.MarkerCluster) {
  const currentZoom = map.getZoom();
  const bounds = cluster.getBounds();
  const sameLocation = boundsAreDegenerate(bounds);

  if (sameLocation) {
    // ── Punti sovrapposti (stesso posto fisico) ──────────────────────────────
    // Questi cluster NON scompaiono mai da soli: a zoom elevato maxClusterRadius=1px
    // li mantiene clustrati. Spiderfy subito se già vicini, altrimenti fly poi spiderfy.
    if (currentZoom >= MAX_CLUSTER_ZOOM) {
      try { cluster.spiderfy(); } catch { /* ignore */ }
      return;
    }
    map.once('moveend', () => {
      try { cluster.spiderfy(); } catch { /* cluster dissolto durante il volo */ }
    });
    map.flyTo(bounds.getCenter(), MAX_CLUSTER_ZOOM, { duration: 0.5 });
  } else {
    // ── Punti sparsi in luoghi diversi ──────────────────────────────────────
    // flyToBounds al livello dove la cluster radius è ancora 1px (zoom 16+)
    // e i punti sparsi appaiono come marker individuali. MAI spiderfy.
    map.flyToBounds(bounds, {
      padding: CLUSTER_FLY_PADDING,
      maxZoom: 17,
      duration: 0.5,
    });
  }
}

export default function MapClusterLayer({ points }: Props) {
  const map = useMap();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersByIdRef = useRef<Map<string, L.Marker>>(new Map());
  const typeByMarkerRef = useRef<WeakMap<L.Marker, PointType>>(new WeakMap());
  const activePinRef = useRef<L.Marker | null>(null);
  const popupZoomHandlerRef = useRef<(() => void) | null>(null);
  const geoPoints = useMemo(
    () => points.filter((p) => p.latitude != null && p.longitude != null),
    [points],
  );

  const pointIdsKey = useMemo(
    () => geoPoints.map((p) => p.id).sort().join(','),
    [geoPoints],
  );

  useEffect(() => {
    const typeByMarker = typeByMarkerRef.current;

    if (!clusterRef.current) {
      const group = L.markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: false,
        spiderfyDistanceMultiplier: 1.5,
        zoomToBoundsOnClick: false,
        maxClusterRadius: clusterRadius,
        animate: false,
        animateAddingMarkers: false,
        chunkedLoading: geoPoints.length > 80,
        chunkInterval: 120,
        chunkDelay: 30,
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

      group.on('clusterclick', ((e: L.LeafletEvent) => {
        const cluster = (e as L.LeafletMouseEvent).layer;
        if (cluster && 'spiderfy' in cluster) {
          handleClusterClick(map, cluster as L.MarkerCluster);
        }
      }) as L.LeafletEventHandlerFn);

      clusterRef.current = group;
      map.addLayer(group);
    }

    const cluster = clusterRef.current;
    const markersById = markersByIdRef.current;
    const nextIds = new Set(geoPoints.map((p) => p.id));

    for (const [id, marker] of markersById) {
      if (!nextIds.has(id)) {
        if (activePinRef.current === marker) {
          activePinRef.current = null;
        }
        cluster.removeLayer(marker);
        markersById.delete(id);
      }
    }

    function clearPopupZoomSync() {
      if (popupZoomHandlerRef.current) {
        map.off('zoom', popupZoomHandlerRef.current);
        map.off('zoomend', popupZoomHandlerRef.current);
        popupZoomHandlerRef.current = null;
      }
    }

    function bindPopupZoomSync(marker: L.Marker) {
      clearPopupZoomSync();
      const sync = () => {
        if (activePinRef.current === marker) syncMarkerPopupOffset(marker);
      };
      popupZoomHandlerRef.current = sync;
      map.on('zoom', sync);
      map.on('zoomend', sync);
    }

    function setActivePin(next: L.Marker | null) {
      const prev = activePinRef.current;
      if (prev && prev !== next) {
        prev.getElement()?.classList.remove('map-pin-active');
        syncMarkerPopupOffset(prev);
      }
      activePinRef.current = next;
      if (!next) {
        clearPopupZoomSync();
        return;
      }
      const applyActive = () => {
        next.getElement()?.classList.add('map-pin-active');
        syncMarkerPopupOffset(next);
      };
      applyActive();
      window.requestAnimationFrame(applyActive);
    }

    for (const p of geoPoints) {
      if (markersById.has(p.id)) continue;

      const marker = L.marker([p.latitude!, p.longitude!], {
        icon: getPointIcon(p.type),
      });
      typeByMarker.set(marker, p.type);
      markersById.set(p.id, marker);

      marker.bindPopup(() => buildMapPopupElement(p), {
        maxWidth: 300,
        minWidth: 260,
        className: 'libery-map-popup',
        closeButton: false,
        offset: L.point(0, 0),
      });

      let onTitleClick: ((e: Event) => void) | null = null;

      marker.on('click', () => {
        setActivePin(marker);
        marker.openPopup();
      });

      marker.on('popupopen', () => {
        setActivePin(marker);
        syncMarkerPopupOffset(marker);
        bindPopupZoomSync(marker);

        const popupEl = marker.getPopup()?.getElement();
        const cardLink = popupEl?.querySelector<HTMLAnchorElement>('.map-popup-card-link');
        if (!cardLink) return;
        onTitleClick = (e: Event) => {
          e.preventDefault();
          const href = cardLink.getAttribute('href');
          if (href) navigateRef.current(href);
        };
        cardLink.addEventListener('click', onTitleClick);
      });

      marker.on('popupclose', () => {
        if (activePinRef.current === marker) setActivePin(null);
        clearPopupZoomSync();
        const popupEl = marker.getPopup()?.getElement();
        const cardLink = popupEl?.querySelector<HTMLAnchorElement>('.map-popup-card-link');
        if (cardLink && onTitleClick) {
          cardLink.removeEventListener('click', onTitleClick);
          onTitleClick = null;
        }
      });

      cluster.addLayer(marker);
    }

    return () => {
      clearPopupZoomSync();
      activePinRef.current?.getElement()?.classList.remove('map-pin-active');
      activePinRef.current = null;
      for (const marker of markersById.values()) {
        cluster.removeLayer(marker);
      }
      markersById.clear();
    };
  }, [map, pointIdsKey]);

  useEffect(() => {
    return () => {
      if (clusterRef.current) {
        map.removeLayer(clusterRef.current);
        clusterRef.current = null;
        markersByIdRef.current.clear();
      }
    };
  }, [map]);

  return null;
}
