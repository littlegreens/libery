import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import axios from 'axios';
import { icons } from '@/lib/assets';
import BookCard from '@/components/BookCard';
import BackLink from '@/components/BackLink';
import LiberyIcon from '@/components/LiberyIcon';
import TakeBookScanner from '@/components/TakeBookScanner';
import { toast } from '@/stores/toastStore';
import type { ShellOutletContext } from '@/components/AppShell';
import { api } from '@/lib/api';
import { POINT_TYPE_LABELS } from '@/lib/mapIcons';
import { useAuthStore } from '@/stores/authStore';
import type { MapPoint } from '@/types/point';

const BOOKS_PAGE_SIZE = 20;

type InventoryBook = {
  id: string;
  isbn: string;
  title: string;
  author: string | null;
  year: number | null;
  genre: string | null;
  coverPath?: string | null;
  copies: number;
};

type MyReservation = {
  id: string;
  expiresAt: string;
  book: { id: string };
  point: { id: string };
};

export default function PointPage() {
  const { id } = useParams<{ id: string }>();
  const { openAuthSheet } = useOutletContext<ShellOutletContext>();
  const loggedIn = useAuthStore((s) => s.isLoggedIn());

  const [point, setPoint] = useState<MapPoint | null>(null);
  const [books, setBooks] = useState<InventoryBook[]>([]);
  const [bookSearch, setBookSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(BOOKS_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reserveBusyId, setReserveBusyId] = useState<string | null>(null);
  const [cancelBusyId, setCancelBusyId] = useState<string | null>(null);
  const [takeTarget, setTakeTarget] = useState<InventoryBook | null>(null);
  const [myReservations, setMyReservations] = useState<MyReservation[]>([]);

  const loadInventory = useCallback(async (pointId: string) => {
    const { data } = await api.get<{ books: InventoryBook[] }>(`/points/${pointId}/books`);
    setBooks(data.books);
  }, []);

  const loadReservations = useCallback(async () => {
    if (!loggedIn) {
      setMyReservations([]);
      return;
    }
    try {
      const { data } = await api.get<{ reservations: MyReservation[] }>('/reservations/mine');
      setMyReservations(data.reservations);
    } catch {
      // silenzioso, non blocchiamo la pagina se /mine fallisce
    }
  }, [loggedIn]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    Promise.all([
      api.get<{ point: MapPoint }>(`/points/${id}`),
      loadInventory(id),
      loadReservations(),
    ])
      .then(([pointRes]) => {
        setPoint(pointRes.data.point);
      })
      .catch(() => setError('Punto non trovato'))
      .finally(() => setLoading(false));
  }, [id, loadInventory, loadReservations]);

  /** Mappa bookId → reservation attiva dell'utente per QUESTO punto */
  const reservationsByBook = useMemo(() => {
    const m = new Map<string, MyReservation>();
    if (!point) return m;
    for (const r of myReservations) {
      if (r.point.id === point.id) m.set(r.book.id, r);
    }
    return m;
  }, [myReservations, point]);

  const canReserve = point?.type === 'biblioteca' || point?.type === 'libreria';

  const filtered = useMemo(() => {
    if (!bookSearch.trim()) return books;
    const q = bookSearch.toLowerCase();
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        (b.author?.toLowerCase().includes(q) ?? false) ||
        b.isbn.includes(q),
    );
  }, [books, bookSearch]);

  useEffect(() => {
    setVisibleCount(BOOKS_PAGE_SIZE);
  }, [bookSearch, books]);

  const visibleBooks = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const requireAuth = (): boolean => {
    if (loggedIn) return true;
    openAuthSheet('login');
    return false;
  };

  const handlePrendi = (book: InventoryBook) => {
    if (!point) return;
    if (!requireAuth()) return;
    setTakeTarget(book);
  };

  const handlePrenota = async (book: InventoryBook) => {
    if (!point) return;
    if (!requireAuth()) return;
    setReserveBusyId(book.id);
    try {
      const { data } = await api.post<{ message: string }>('/reservations', {
        pointId: point.id,
        bookId: book.id,
      });
      toast.success(data.message ?? 'Libro prenotato', { title: 'Prenotazione' });
      await Promise.all([loadInventory(point.id), loadReservations()]);
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error ?? 'Prenotazione non riuscita'
        : 'Errore di rete';
      toast.error(msg, { title: 'Prenotazione fallita' });
    } finally {
      setReserveBusyId(null);
    }
  };

  const handleCancellaPrenotazione = async (reservationId: string) => {
    if (!point) return;
    setCancelBusyId(reservationId);
    try {
      await api.delete(`/reservations/${reservationId}`);
      toast.info('Prenotazione annullata');
      await Promise.all([loadInventory(point.id), loadReservations()]);
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error ?? 'Annullamento non riuscito'
        : 'Errore di rete';
      toast.error(msg);
    } finally {
      setCancelBusyId(null);
    }
  };

  const opening = point?.openingHours as Record<string, string> | null | undefined;
  const heroPhoto = point?.photoUrl;

  return (
    <div className="page-content point-page">
      {loading && <p className="text-muted px-3 py-3">Caricamento…</p>}
      {error && <p className="text-danger px-3 py-3">{error}</p>}

      {point && (
        <>
          <div className="point-hero">
            <BackLink className="point-page-back" />
            {heroPhoto ? (
              <img src={heroPhoto} alt="" className="point-hero-img" />
            ) : (
              <div className="point-hero-placeholder" aria-hidden>
                <span className="point-hero-placeholder-icon">
                  <LiberyIcon src={icons.book} width={36} height={36} />
                </span>
              </div>
            )}
          </div>

          <div className="px-3 py-3 point-page-body">
            <span className={`map-popup-type map-popup-type--${point.type} mb-2`}>
              {POINT_TYPE_LABELS[point.type]}
            </span>
            <h1 className="h4 fw-bold mb-2">{point.name}</h1>
            {(point.address || point.city) && (
              <p className="text-muted mb-2">
                {[point.address, point.city].filter(Boolean).join(', ')}
              </p>
            )}
            {point.description && <p className="mb-3">{point.description}</p>}

            {opening && (
              <div className="mb-4 small">
                <strong className="d-block mb-1">Orari</strong>
                <ul className="list-unstyled mb-0 text-muted">
                  {Object.entries(opening).map(([day, hours]) => (
                    <li key={day}>
                      <span className="text-capitalize">{day}</span>: {hours}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="small text-muted mb-3">
              <strong>Prendi</strong>: inquadra l&apos;ISBN del volume — finisce nel tuo zaino.{' '}
              {canReserve && (
                <>
                  <strong>Prenota</strong>: il libro resta riservato per te per 24 ore.
                </>
              )}{' '}
              Per <strong>lasciare</strong> un libro usa il pulsante fotocamera in basso.
            </p>

            <h2 className="h6 fw-bold mb-2">Libri disponibili ({filtered.length})</h2>
            <input
              type="search"
              className="form-control form-control-sm mb-3"
              placeholder="Filtra titolo, autore, ISBN…"
              value={bookSearch}
              onChange={(e) => setBookSearch(e.target.value)}
            />

            {filtered.length === 0 ? (
              <p className="text-muted small">Nessun libro disponibile al momento.</p>
            ) : (
              <>
                <ul className="list-unstyled mb-0 book-card-list">
                  {visibleBooks.map((b) => {
                    const reservation = reservationsByBook.get(b.id);
                    const linkState = {
                      from: { to: `/punto/${point.id}`, label: `Torna a ${point.name}` },
                      // retro-compat con la vecchia logica "altre sedi"
                      pointId: point.id,
                      pointName: point.name,
                    };

                    if (reservation) {
                      return (
                        <BookCard
                          key={b.id}
                          book={b}
                          linkState={linkState}
                          reserved={{
                            expiresAt: reservation.expiresAt,
                            // Su questo punto siamo già: niente nome/indirizzo duplicato.
                            actions: (
                              <button
                                type="button"
                                className="btn btn-libery-leave"
                                disabled={cancelBusyId === reservation.id}
                                onClick={() => void handleCancellaPrenotazione(reservation.id)}
                              >
                                {cancelBusyId === reservation.id ? '…' : 'Lascia'}
                              </button>
                            ),
                          }}
                        />
                      );
                    }

                    return (
                      <BookCard
                        key={b.id}
                        book={b}
                        linkState={linkState}
                        coverBadge={`${b.copies} ${b.copies === 1 ? 'copia' : 'copie'}`}
                        subtitle={b.year ? String(b.year) : undefined}
                        actions={
                          <div className="point-book-action-btns">
                            <button
                              type="button"
                              className="btn btn-libery btn-sm"
                              disabled={b.copies < 1}
                              onClick={() => handlePrendi(b)}
                            >
                              Prendi
                            </button>
                            {canReserve && (
                              <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm"
                                disabled={reserveBusyId === b.id || b.copies < 1}
                                onClick={() => void handlePrenota(b)}
                              >
                                {reserveBusyId === b.id ? '…' : 'Prenota'}
                              </button>
                            )}
                          </div>
                        }
                      />
                    );
                  })}
                </ul>

                {hasMore && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm w-100 mt-3"
                    onClick={() => setVisibleCount((n) => n + BOOKS_PAGE_SIZE)}
                  >
                    Carica altri ({filtered.length - visibleCount} rimanenti)
                  </button>
                )}
              </>
            )}
          </div>

          {takeTarget && (
            <TakeBookScanner
              open
              pointId={point.id}
              pointName={point.name}
              latitude={point.latitude}
              longitude={point.longitude}
              book={takeTarget}
              onClose={() => setTakeTarget(null)}
              onSuccess={(msg) => {
                toast.success(msg, { title: 'Fatto' });
                void loadInventory(point.id);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
