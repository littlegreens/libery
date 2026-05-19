import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

/** Da questo zoom i pin iniziano a crescere leggermente */
const PIN_SCALE_START_ZOOM = 8;
/** Incremento scala per livello di zoom */
const PIN_SCALE_PER_ZOOM = 0.028;
const PIN_SCALE_MAX = 1.32;

function pinZoomScale(zoom: number): number {
  const extra = Math.max(0, zoom - PIN_SCALE_START_ZOOM) * PIN_SCALE_PER_ZOOM;
  return Math.min(PIN_SCALE_MAX, 1 + extra);
}

export default function MapPinZoomScale() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();

    const apply = () => {
      container.style.setProperty('--pin-zoom-scale', String(pinZoomScale(map.getZoom())));
    };

    apply();
    map.on('zoom', apply);
    map.on('zoomend', apply);
    return () => {
      map.off('zoom', apply);
      map.off('zoomend', apply);
      container.style.removeProperty('--pin-zoom-scale');
    };
  }, [map]);

  return null;
}
