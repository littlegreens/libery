import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import MapClusterLayer from '@/components/MapClusterLayer';
import MapLocateBar from '@/components/MapLocateBar';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '@/lib/api';
import { LiberyButton, MdIcon } from '@/lib/material/md-react';
import { userLocationIcon } from '@/lib/mapIcons';
import { LIBERY_MAP_TILE } from '@/lib/mapTiles';
import { useUserPosition } from '@/stores/locationStore';
import type { MapPoint } from '@/types/point';

const ITALY_CENTER: L.LatLngExpression = [42.5, 12.5];
const USER_MAP_ZOOM = 14;

function MapRefBridge({ onMap }: { onMap: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    onMap(map);
  }, [map, onMap]);
  return null;
}

function MapInvalidate() {
  const map = useMap();
  useEffect(() => {
    const resize = () => map.invalidateSize({ animate: false });
    resize();
    const t1 = setTimeout(resize, 150);
    const t2 = setTimeout(resize, 500);
    const t3 = setTimeout(resize, 1000);
    window.addEventListener('resize', resize);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', resize);
    };
  }, [map]);
  return null;
}

function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    const coords = points
      .filter((p) => p.latitude != null && p.longitude != null)
      .map((p) => [p.latitude!, p.longitude!] as [number, number]);
    if (coords.length === 1) {
      map.setView(coords[0], 14);
    } else if (coords.length > 1) {
      map.fitBounds(L.latLngBounds(coords), { padding: [48, 48], maxZoom: 12 });
    }
    setTimeout(() => map.invalidateSize({ animate: false }), 200);
  }, [map, points]);
  return null;
}

export default function MapPage() {
  useDocumentTitle('Mappa');
  const location = useLocation();
  const mapWrapRef = useRef<HTMLDivElement>(null);
  const [mapReady, setMapReady] = useState(false);
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { pos: userPos } = useUserPosition();
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  const loadPoints = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<{ points: MapPoint[] }>('/points', {
        params: { status: 'approved' },
      });
      setPoints(data.points);
    } catch {
      setError('Punti non disponibili al momento');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPoints();
  }, [loadPoints]);

  useEffect(() => {
    const el = mapWrapRef.current;
    if (!el) return;

    const check = () => {
      if (el.offsetHeight > 80) setMapReady(true);
    };
    check();

    const ro = new ResizeObserver(check);
    ro.observe(el);
    window.addEventListener('resize', check);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', check);
    };
  }, []);

  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        setMapReady(false);
        setTimeout(() => setMapReady(true), 50);
        window.dispatchEvent(new Event('resize'));
      }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  function locateMe() {
    if (userPos && mapInstance) {
      mapInstance.flyTo([userPos.lat, userPos.lng], USER_MAP_ZOOM, { duration: 0.8 });
    }
  }

  const visiblePoints = useMemo(
    () => points.filter((p) => p.latitude != null && p.longitude != null),
    [points],
  );

  return (
    <div className="map-page">
      <div ref={mapWrapRef} className="map-wrap position-relative">
        {!error && (
          <MapLocateBar
            userPos={userPos}
            mapReady={Boolean(mapInstance)}
            onLocate={locateMe}
          />
        )}

        {error && (
          <div className="map-overlay-message map-overlay-message--error" role="alert">
            <MdIcon className="map-overlay-message__icon" aria-hidden>cloud_off</MdIcon>
            <p className="mb-2">{error}</p>
            <LiberyButton type="button" color="outlined" size="small" onClick={loadPoints}>
              Riprova
            </LiberyButton>
          </div>
        )}

        {mapReady && !error && (
          <MapContainer
            key={`map-${location.key}`}
            center={ITALY_CENTER}
            zoom={6}
            className="map-leaflet"
            scrollWheelZoom
            zoomControl={false}
            attributionControl={false}
          >
            <MapInvalidate />
            <MapRefBridge onMap={setMapInstance} />
            <TileLayer
              url={LIBERY_MAP_TILE.url}
              attribution={LIBERY_MAP_TILE.attribution}
            />
            {visiblePoints.length > 0 && <FitBounds points={visiblePoints} />}
            <MapClusterLayer points={visiblePoints} />
            {userPos && (
              <Marker position={[userPos.lat, userPos.lng]} icon={userLocationIcon}>
                <Popup>Tu sei qui</Popup>
              </Marker>
            )}
          </MapContainer>
        )}

        {!mapReady && !loading && !error && (
          <div className="map-overlay-message map-overlay-message--prep" role="status">
            <MdIcon className="map-overlay-message__icon map-overlay-message__icon--spin">progress_activity</MdIcon>
            <span>Preparazione mappa…</span>
          </div>
        )}
      </div>
    </div>
  );
}
