import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getPointIcon } from '@/lib/mapIcons';
import { LIBERY_MAP_TILE } from '@/lib/mapTiles';
import type { PointType } from '@/types/point';

function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const run = () => map.invalidateSize({ animate: false });
    run();
    const t = window.setTimeout(run, 200);
    return () => window.clearTimeout(t);
  }, [map]);
  return null;
}

type Props = {
  latitude: number;
  longitude: number;
  type: PointType;
  className?: string;
};

/** Mappa compatta con un solo pin (scheda punto), navigabile. */
export default function PointMiniMap({ latitude, longitude, type, className }: Props) {
  const center: L.LatLngExpression = [latitude, longitude];

  return (
    <div className={['point-mini-map', className].filter(Boolean).join(' ')}>
      <MapContainer
        center={center}
        zoom={15}
        scrollWheelZoom
        dragging
        touchZoom
        doubleClickZoom
        zoomControl
        attributionControl={false}
        className="point-mini-map__leaflet"
      >
        <TileLayer url={LIBERY_MAP_TILE.url} attribution={LIBERY_MAP_TILE.attribution} />
        <InvalidateSize />
        <Marker position={center} icon={getPointIcon(type)} />
      </MapContainer>
    </div>
  );
}
