import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import MapClusterLayer from '@/components/MapClusterLayer';
import MapPinZoomScale from '@/components/MapPinZoomScale';
import BookSheet from '@/components/BookSheet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '@/lib/api';
import { userLocationIcon } from '@/lib/mapIcons';
import { useUserPosition } from '@/stores/locationStore';
import type { BookSummary } from '@/types/book';
import type { MapPoint } from '@/types/point';

const ITALY_CENTER: L.LatLngExpression = [42.5, 12.5];

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
  const location = useLocation();
  const mapWrapRef = useRef<HTMLDivElement>(null);
  const [mapReady, setMapReady] = useState(false);
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bookQuery, setBookQuery] = useState('');
  const [selectedBook, setSelectedBook] = useState<BookSummary | null>(null);
  const [otherBooks, setOtherBooks] = useState<BookSummary[]>([]);
  const [matchingPointIds, setMatchingPointIds] = useState<Set<string> | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
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
      setError('Server non raggiungibile — avvia API su :3001');
    } finally {
      setLoading(false);
    }
  }, []);

  const searchBooks = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setMatchingPointIds(null);
      setSelectedBook(null);
      setOtherBooks([]);
      return;
    }

    setSearchLoading(true);
    try {
      const { data } = await api.get<{ books: BookSummary[] }>('/books/search', {
        params: { q: trimmed },
      });

      const ids = new Set<string>();
      for (const book of data.books) {
        for (const slot of book.availability) {
          ids.add(slot.pointId);
        }
      }

      setMatchingPointIds(ids);
      setSelectedBook(data.books[0] ?? null);
      setOtherBooks(data.books.slice(1, 4));
    } catch {
      setMatchingPointIds(new Set());
      setSelectedBook(null);
      setOtherBooks([]);
    } finally {
      setSearchLoading(false);
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

  useEffect(() => {
    if (!bookQuery.trim()) {
      setMatchingPointIds(null);
      setSelectedBook(null);
      setOtherBooks([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void searchBooks(bookQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [bookQuery, searchBooks]);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    void searchBooks(bookQuery);
  }

  function clearSearch() {
    setBookQuery('');
    setMatchingPointIds(null);
    setSelectedBook(null);
    setOtherBooks([]);
  }

  function goToPoint(pointId: string) {
    const p = points.find((x) => x.id === pointId);
    if (p?.latitude != null && p.longitude != null && mapInstance) {
      mapInstance.flyTo([p.latitude, p.longitude], 15, { duration: 0.7 });
    }
  }

  const visiblePoints = useMemo(() => {
    const geo = points.filter((p) => p.latitude != null && p.longitude != null);
    if (matchingPointIds === null) return geo;
    return geo.filter((p) => matchingPointIds.has(p.id));
  }, [points, matchingPointIds]);

  return (
    <div className="map-page">
      <div ref={mapWrapRef} className="map-wrap position-relative">
        {!loading && !error && (
          <div className="map-search-bar">
            <form className="map-search-form" onSubmit={handleSearchSubmit}>
              <input
                type="search"
                className="map-search-input"
                placeholder="Cerca un libro (titolo, autore, ISBN)…"
                value={bookQuery}
                onChange={(e) => setBookQuery(e.target.value)}
                aria-label="Cerca libro sulla mappa"
              />
            </form>
            <button
              type="button"
              className="map-locate-btn"
              title="Centra sulla mia posizione"
              disabled={!userPos || !mapInstance}
              onClick={() => userPos && mapInstance?.flyTo([userPos.lat, userPos.lng], 14, { duration: 0.8 })}
              aria-label="Centra sulla mia posizione"
            >
              ◎
            </button>
          </div>
        )}

        {searchLoading && bookQuery.trim() && !loading && !error && (
          <p className="map-search-status">Ricerca…</p>
        )}

        {selectedBook && !searchLoading && !loading && !error && (
          <div className="map-book-sheet-wrap">
            <BookSheet
              book={selectedBook}
              points={points}
              userPos={userPos}
              onClose={clearSearch}
              onGoToPoint={goToPoint}
            />
            {otherBooks.length > 0 && (
              <div className="map-other-books">
                <p className="small text-muted mb-1">Altri risultati</p>
                <ul className="list-unstyled mb-0">
                  {otherBooks.map((b) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        className="map-other-book-btn"
                        onClick={() => {
                          const prev = selectedBook;
                          setSelectedBook(b);
                          if (prev) {
                            setOtherBooks((list) =>
                              [prev, ...list.filter((x) => x.id !== b.id)].slice(0, 3),
                            );
                          }
                          const ids = new Set<string>();
                          for (const slot of b.availability) ids.add(slot.pointId);
                          setMatchingPointIds(ids);
                        }}
                      >
                        {b.title}
                        {b.author && <span className="text-muted"> — {b.author}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {loading && <div className="map-overlay-message">Caricamento…</div>}
        {error && (
          <div className="map-overlay-message text-danger">
            {error}
            <button type="button" className="btn btn-sm btn-libery mt-2 d-block mx-auto" onClick={loadPoints}>
              Riprova
            </button>
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
          >
            <MapInvalidate />
            <MapPinZoomScale />
            <MapRefBridge onMap={setMapInstance} />
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
          <div className="map-overlay-message">Preparazione mappa…</div>
        )}
      </div>
    </div>
  );
}
