import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import axios from 'axios';
import BookListRow from '@/components/BookListRow';
import type { BookListRowMenuItems } from '@/components/BookListRowMenu';
import { BOOK_ACTION_LABELS } from '@/lib/bookActions';
import LiberyIcon from '@/components/LiberyIcon';
import LiberyNumChip from '@/components/LiberyNumChip';
import PointMiniMap from '@/components/PointMiniMap';
import TakeBookScanner from '@/components/TakeBookScanner';
import UserPickupQrSheet from '@/components/UserPickupQrSheet';
import PointPageTopActions from '@/components/PointPageTopActions';
import { toast } from '@/stores/toastStore';
import type { ShellOutletContext } from '@/components/AppShell';
import { api } from '@/lib/api';
import { externalMapsSearchUrl } from '@/lib/mapsLink';
import LiberyOutlinedSearchField from '@/components/LiberyOutlinedSearchField';
import { LiberyButton } from '@/lib/material/md-react';
import LiberyLoading from '@/components/LiberyLoading';
import PointTypeBadge from '@/components/PointTypeBadge';
import { POINT_TYPE_HERO, POINT_TYPE_LABELS } from '@/lib/mapIcons';
import { useAuthStore } from '@/stores/authStore';
import { useSlotsStore } from '@/stores/slotsStore';
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
  myReservation?: { id: string; expiresAt: string };
};

type SlotSummary = {
  libriOggi: number;
  libriExtra: number;
  libriTotali: number;
  activeReservations: number;
  slotsFree: number;
};

type MyReservation = {
  id: string;
  expiresAt: string;
  book: { id: string };
  point: { id: string };
};

export default function PointPage() {
  const { id } = useParams<{ id: string }>();
  const { openAuthSheet, setPageBar } = useOutletContext<ShellOutletContext>();
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
  const [pickupQrBook, setPickupQrBook] = useState<InventoryBook | null>(null);
  const [reportBusyId, setReportBusyId] = useState<string | null>(null);
  const [myReservations, setMyReservations] = useState<MyReservation[]>([]);
  const [slotSummary, setSlotSummary] = useState<SlotSummary | null>(null);

  const loadInventory = useCallback(async (pointId: string) => {
    const { data } = await api.get<{ books: InventoryBook[] }>(`/points/${pointId}/books`);
    setBooks(data.books);
  }, []);

  const refreshSlots = useSlotsStore((s) => s.refreshSlots);

  const loadReservations = useCallback(async () => {
    if (!loggedIn) {
      setMyReservations([]);
      setSlotSummary(null);
      return;
    }
    try {
      const { data } = await api.get<{ reservations: MyReservation[]; slots: SlotSummary }>(
        '/reservations/mine',
      );
      setMyReservations(data.reservations);
      setSlotSummary(data.slots);
      useSlotsStore.setState({ slots: data.slots });
    } catch {
      // silenzioso
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

  useEffect(() => {
    if (!point) {
      setPageBar({
        title: 'Punto',
        subtitle: error || undefined,
        showBack: true,
        hideTitle: true,
      });
      return () => setPageBar(null);
    }
    const mapsHref = externalMapsSearchUrl(
      point.latitude,
      point.longitude,
      point.address,
      point.city,
    );
    const canNavigate =
      (point.latitude != null && point.longitude != null) ||
      Boolean(point.address?.trim() || point.city?.trim());

    setPageBar({
      title: point.name,
      subtitle: POINT_TYPE_LABELS[point.type],
      showBack: true,
      hideTitle: true,
      trailing: (
        <PointPageTopActions
          pointId={point.id}
          pointName={point.name}
          pointType={point.type}
          mapsHref={mapsHref}
          canNavigate={canNavigate}
          showSlots={loggedIn}
          slotsSummary={slotSummary}
        />
      ),
    });
    return () => setPageBar(null);
  }, [point, loading, error, setPageBar, loggedIn, slotSummary]);

  const reservationsByBook = useMemo(() => {
    const m = new Map<string, MyReservation>();
    if (!point) return m;
    for (const r of myReservations) {
      if (r.point.id === point.id) m.set(r.book.id, r);
    }
    return m;
  }, [myReservations, point]);

  const canReserve = point?.type === 'biblioteca' || point?.type === 'libreria';
  const slotsFree = slotSummary?.slotsFree ?? 0;

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

  const handleRiceviOrRitira = (book: InventoryBook, _opts?: { reserved?: boolean }) => {
    if (!point) return;
    if (!requireAuth()) return;
    const isCertified = point.type === 'biblioteca' || point.type === 'libreria';
    if (isCertified) {
      setPickupQrBook(book);
      return;
    }
    setTakeTarget(book);
  };

  const handleReportMissing = async (book: InventoryBook) => {
    if (!point) return;
    if (!requireAuth()) return;
    setReportBusyId(book.id);
    try {
      const { data } = await api.post<{ message: string }>('/reports', {
        pointId: point.id,
        bookId: book.id,
        type: 'missing',
      });
      toast.success(data.message);
      await loadInventory(point.id);
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error ?? 'Segnalazione non riuscita'
        : 'Errore di rete';
      toast.error(msg);
    } finally {
      setReportBusyId(null);
    }
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
      toast.success(data.message ?? 'Libro prenotato');
      await Promise.all([loadInventory(point.id), loadReservations(), refreshSlots()]);
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error ?? 'Prenotazione non riuscita'
        : 'Errore di rete';
      toast.error(msg);
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
      await Promise.all([loadInventory(point.id), loadReservations(), refreshSlots()]);
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
  const heroTheme = point ? POINT_TYPE_HERO[point.type] : null;
  const addressLine = point ? [point.address, point.city].filter(Boolean).join(', ') : '';
  const mapsHref = point
    ? externalMapsSearchUrl(point.latitude, point.longitude, point.address, point.city)
    : '#';

  return (
    <div className="page-content point-page">
      {loading && <LiberyLoading variant="page" />}
      {error && <p className="text-danger px-3 py-3">{error}</p>}

      {point && heroTheme && (
        <>
          <div className="point-hero">
            {heroPhoto ? (
              <img src={heroPhoto} alt="" className="point-hero-img" />
            ) : (
              <div
                className="point-hero-placeholder"
                style={{ backgroundColor: heroTheme.fill }}
                aria-hidden
              >
                <LiberyIcon src={heroTheme.iconSrc} width={48} height={48} className="point-hero-type-icon" />
              </div>
            )}
          </div>

          <div className="point-page-body">
            <div className="point-page-head">
              <PointTypeBadge type={point.type} className="flush" />
              <h1 className="libery-page-title libery-page-title--detail">{point.name}</h1>
            </div>

            {point.description ? <p className="point-page-desc mb-3">{point.description}</p> : null}

            {point.latitude != null && point.longitude != null ? (
              <section className="point-page-map-block mb-3" aria-label="Posizione sulla mappa">
                <PointMiniMap latitude={point.latitude} longitude={point.longitude} type={point.type} />
                {addressLine ? (
                  <a
                    href={mapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="point-page-address-text"
                  >
                    {addressLine}
                  </a>
                ) : null}
              </section>
            ) : addressLine ? (
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="point-page-address-text mb-3"
              >
                {addressLine}
              </a>
            ) : null}

            {opening && (
              <section className="point-page-hours mb-4">
                <h2 className="libery-page-section-title">Orari</h2>
                <ul className="list-unstyled mb-0 point-page-hours-list">
                  {Object.entries(opening).map(([day, hours]) => (
                    <li key={day}>
                      <span className="text-capitalize">{day}</span>
                      <span className="point-page-hours-sep"> · </span>
                      {hours}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="libery-section-heading mb-2">
              <h2 className="libery-page-section-title mb-0">Libri disponibili</h2>
              {filtered.length > 0 ? (
                <LiberyNumChip value={filtered.length} aria-label={`${filtered.length} libri`} />
              ) : null}
            </div>

            <div className="libery-search-form libery-search-form--inline mb-3">
              <div className="libery-search-row">
                <LiberyOutlinedSearchField
                  className="libery-search-field"
                  id={`point-books-filter-${point.id}`}
                  label="Filtra"
                  placeholder="Titolo, autore, ISBN…"
                  value={bookSearch}
                  onValueChange={setBookSearch}
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <p className="text-muted small">Nessun libro disponibile al momento.</p>
            ) : (
              <>
                <div className="libery-book-list">
                  {visibleBooks.map((b, bookIdx) => {
                    const reservation =
                      b.myReservation != null
                        ? {
                            id: b.myReservation.id,
                            expiresAt: b.myReservation.expiresAt,
                            book: { id: b.id },
                            point: { id: point.id },
                          }
                        : reservationsByBook.get(b.id);
                    const isReservedByMe = Boolean(reservation);
                    const canPrenota = canReserve && slotsFree > 0 && b.copies > 0;
                    const canPrendi = slotsFree > 0;
                    const linkState = {
                      from: { to: `/punto/${point.id}`, label: `Torna a ${point.name}` },
                      pointId: point.id,
                      pointName: point.name,
                    };

                    const favoriteBook = {
                      id: b.id,
                      isbn: b.isbn,
                      title: b.title,
                      author: b.author,
                      year: b.year,
                      genre: b.genre,
                      coverPath: b.coverPath ?? null,
                    };

                    const pointBookMenu = (): BookListRowMenuItems | undefined => {
                      if (!loggedIn) return undefined;
                      const menu: BookListRowMenuItems = {
                        favorite: { bookId: b.id, book: favoriteBook },
                      };
                      if (canReserve) {
                        menu.prenota = {
                          onClick: () => void handlePrenota(b),
                          disabled: !canPrenota,
                          busy: reserveBusyId === b.id,
                        };
                      }
                      if (
                        (point.type === 'biblioteca' || point.type === 'libreria') &&
                        b.copies > 0
                      ) {
                        menu.prendi = {
                          onClick: () => handleRiceviOrRitira(b),
                          disabled: !canPrendi,
                          label: BOOK_ACTION_LABELS.ricevi,
                        };
                      }
                      if (point.type === 'corner_free' && b.copies > 0) {
                        menu.prendi = {
                          onClick: () => handleRiceviOrRitira(b),
                          disabled: !canPrendi,
                          label: BOOK_ACTION_LABELS.ricevi,
                        };
                        menu.nonCePiu = {
                          onClick: () => void handleReportMissing(b),
                          busy: reportBusyId === b.id,
                        };
                      }
                      return menu;
                    };

                    if (isReservedByMe && reservation) {
                      const reservedMenu = (): BookListRowMenuItems | undefined => {
                        if (!loggedIn) return undefined;
                        return {
                          favorite: { bookId: b.id, book: favoriteBook },
                          prendi: {
                            onClick: () => handleRiceviOrRitira(b, { reserved: true }),
                            disabled: false,
                            label: BOOK_ACTION_LABELS.ritira,
                          },
                          annullaPrenotazione: {
                            onClick: () => void handleCancellaPrenotazione(reservation.id),
                            disabled: cancelBusyId === reservation.id,
                            busy: cancelBusyId === reservation.id,
                          },
                        };
                      };

                      return (
                        <BookListRow
                          key={b.id}
                          book={b}
                          linkState={linkState}
                          reserved={{
                            expiresAt: reservation.expiresAt,
                            badgeLabel: 'Prenotato da te',
                          }}
                          isLast={bookIdx === visibleBooks.length - 1}
                          menu={reservedMenu()}
                        />
                      );
                    }

                    return (
                      <BookListRow
                        key={b.id}
                        book={b}
                        linkState={linkState}
                        copies={b.copies}
                        isLast={bookIdx === visibleBooks.length - 1}
                        menu={pointBookMenu()}
                      />
                    );
                  })}
                </div>

                {hasMore ? (
                  <LiberyButton
                    type="button"
                    color="outlined"
                    size="small"
                    className="w-100 mt-3"
                    onClick={() => setVisibleCount((n) => n + BOOKS_PAGE_SIZE)}
                  >
                    Carica altri ({filtered.length - visibleCount} rimanenti)
                  </LiberyButton>
                ) : null}
              </>
            )}
          </div>

          {takeTarget ? (
            <TakeBookScanner
              open
              pointId={point.id}
              pointName={point.name}
              latitude={point.latitude}
              longitude={point.longitude}
              book={takeTarget}
              onClose={() => setTakeTarget(null)}
              onSuccess={(msg) => {
                toast.success(msg);
                void loadInventory(point.id);
                void loadReservations();
                void refreshSlots();
              }}
            />
          ) : null}

          {pickupQrBook ? (
            <UserPickupQrSheet
              open
              book={pickupQrBook}
              pointName={point.name}
              onOpenChange={(next) => {
                if (!next) setPickupQrBook(null);
              }}
              onVerified={() => {
                setPickupQrBook(null);
                void loadInventory(point.id);
                void loadReservations();
              }}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
