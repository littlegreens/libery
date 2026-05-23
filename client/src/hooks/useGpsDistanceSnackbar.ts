import { useEffect, useRef } from 'react';
import { useLocationStore } from '@/stores/locationStore';
import { toast } from '@/stores/toastStore';

const GPS_DISTANCE_MSG =
  'Attiva il GPS per vedere le distanze dai punti Libery.';

/**
 * Mostra una volta lo snackbar (barra scura in basso) se manca la posizione.
 */
export function useGpsDistanceSnackbar(active: boolean) {
  const pos = useLocationStore((s) => s.pos);
  const status = useLocationStore((s) => s.status);
  const shownRef = useRef(false);

  useEffect(() => {
    if (!active || pos) {
      if (pos) shownRef.current = false;
      return;
    }
    if (shownRef.current) return;
    if (status === 'requesting') return;

    const t = window.setTimeout(() => {
      if (useLocationStore.getState().pos) return;
      shownRef.current = true;
      toast.info(GPS_DISTANCE_MSG, { duration: 5500 });
    }, status === 'idle' ? 1200 : 400);

    return () => window.clearTimeout(t);
  }, [active, pos, status]);
}
