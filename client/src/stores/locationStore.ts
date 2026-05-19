import { create } from 'zustand';

export type GeoStatus =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'unavailable'
  | 'timeout';

export type GeoPos = { lat: number; lng: number; accuracy?: number; ts: number };

type LocationState = {
  pos: GeoPos | null;
  status: GeoStatus;
  watchId: number | null;
  /** Richiede una nuova posizione (one-shot). Se in corso, no-op. */
  request: () => void;
  /** Attiva il watch continuo se permessi ok. Idempotente. */
  startWatch: () => void;
  stopWatch: () => void;
  reset: () => void;
};

const POSITION_OPTS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 10000,
  maximumAge: 30000,
};

export const useLocationStore = create<LocationState>((set, get) => ({
  pos: null,
  status: 'idle',
  watchId: null,

  request: () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      set({ status: 'unavailable' });
      return;
    }
    const s = get().status;
    if (s === 'requesting') return;
    set({ status: 'requesting' });

    navigator.geolocation.getCurrentPosition(
      (p) =>
        set({
          pos: {
            lat: p.coords.latitude,
            lng: p.coords.longitude,
            accuracy: p.coords.accuracy,
            ts: Date.now(),
          },
          status: 'granted',
        }),
      (err) => {
        let status: GeoStatus = 'denied';
        if (err.code === err.POSITION_UNAVAILABLE) status = 'unavailable';
        else if (err.code === err.TIMEOUT) status = 'timeout';
        set({ status });
      },
      POSITION_OPTS,
    );
  },

  startWatch: () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      set({ status: 'unavailable' });
      return;
    }
    if (get().watchId != null) return;
    set({ status: 'requesting' });
    const id = navigator.geolocation.watchPosition(
      (p) =>
        set({
          pos: {
            lat: p.coords.latitude,
            lng: p.coords.longitude,
            accuracy: p.coords.accuracy,
            ts: Date.now(),
          },
          status: 'granted',
        }),
      (err) => {
        let status: GeoStatus = 'denied';
        if (err.code === err.POSITION_UNAVAILABLE) status = 'unavailable';
        else if (err.code === err.TIMEOUT) status = 'timeout';
        set({ status });
      },
      POSITION_OPTS,
    );
    set({ watchId: id });
  },

  stopWatch: () => {
    const id = get().watchId;
    if (id != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(id);
    }
    set({ watchId: null });
  },

  reset: () => set({ pos: null, status: 'idle' }),
}));

/**
 * Hook di comodo che restituisce la posizione corrente e richiede automaticamente
 * il permesso al primo render se siamo ancora idle.
 */
export function useUserPosition(): { pos: GeoPos | null; status: GeoStatus } {
  const pos = useLocationStore((s) => s.pos);
  const status = useLocationStore((s) => s.status);
  return { pos, status };
}
