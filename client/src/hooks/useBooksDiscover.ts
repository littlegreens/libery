import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { DiscoverPayload } from '@/components/BookDiscoverSections';
import { useLocationStore } from '@/stores/locationStore';
import { useSearchBooksStore } from '@/stores/searchBooksStore';

/** Attesa massima per il primo fix GPS prima di caricare senza coordinate. */
const GPS_WAIT_MS = 2500;

/**
 * Carica le sezioni discover (/books/discover) una sola volta per sessione app.
 * Non si aggiorna al variare del GPS (watch continuo in AppShell).
 */
export function useBooksDiscover(active: boolean): {
  discover: DiscoverPayload | null;
  loading: boolean;
} {
  const cached = useSearchBooksStore((s) => s.discoverCache);
  const setDiscoverCache = useSearchBooksStore((s) => s.setDiscoverCache);
  const [loading, setLoading] = useState(() => active && !cached);
  const inflightRef = useRef(false);

  useEffect(() => {
    if (!active) {
      setLoading(false);
      return;
    }

    const fromStore = useSearchBooksStore.getState().discoverCache;
    if (fromStore) {
      setLoading(false);
      return;
    }

    if (inflightRef.current) return;
    inflightRef.current = true;

    let cancelled = false;
    const ac = new AbortController();

    const runFetch = (lat?: number, lng?: number) => {
      if (cancelled || useSearchBooksStore.getState().discoverCache) return;

      setLoading(true);
      const params: Record<string, number> = {};
      if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
        params.lat = lat;
        params.lng = lng;
      }

      api
        .get<DiscoverPayload>('/books/discover', { params, signal: ac.signal })
        .then((r) => {
          if (!cancelled) setDiscoverCache(r.data);
        })
        .catch(() => {
          /* mantieni cache assente */
        })
        .finally(() => {
          inflightRef.current = false;
          if (!cancelled) setLoading(false);
        });
    };

    const pos = useLocationStore.getState().pos;
    if (pos) {
      runFetch(pos.lat, pos.lng);
      return () => {
        cancelled = true;
        ac.abort();
      };
    }

    let fetched = false;
    const unsub = useLocationStore.subscribe((state) => {
      if (fetched || cancelled || !state.pos) return;
      fetched = true;
      unsub();
      clearTimeout(timer);
      runFetch(state.pos.lat, state.pos.lng);
    });

    const timer = window.setTimeout(() => {
      if (fetched || cancelled) return;
      fetched = true;
      unsub();
      runFetch();
    }, GPS_WAIT_MS);

    return () => {
      cancelled = true;
      inflightRef.current = false;
      ac.abort();
      unsub();
      clearTimeout(timer);
    };
  }, [active, setDiscoverCache]);

  return {
    discover: cached,
    loading: active && loading && !cached,
  };
}
