import { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { api } from '@/lib/api';
import BookCard from '@/components/BookCard';
import FavoriteStar from '@/components/FavoriteStar';
import type { ShellOutletContext } from '@/components/AppShell';
import { useAuthStore } from '@/stores/authStore';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { toast } from '@/stores/toastStore';

type BookLite = {
  id: string;
  title: string;
  author: string | null;
  isbn: string;
  coverPath?: string | null;
};

type PointLite = {
  id: string;
  name: string;
  city: string | null;
  address?: string | null;
};

type BackpackItem = {
  id: string;
  date: string;
  book: BookLite;
  point: PointLite;
};

type ReservedItem = {
  id: string;
  expiresAt: string;
  book: BookLite;
  point: PointLite;
};

type BackpackTab = 'taken' | 'donated' | 'favorites';

const BACK_STATE = { from: { to: '/zaino', label: 'Torna allo zaino' } };

export default function BackpackPage() {
  const { openLeaveFromBackpack } = useOutletContext<ShellOutletContext>();
  const loggedIn = useAuthStore((s) => s.isLoggedIn());
  const [tab, setTab] = useState<BackpackTab>('taken');
  const [taken, setTaken] = useState<BackpackItem[]>([]);
  const [donated, setDonated] = useState<BackpackItem[]>([]);
  const [reserved, setReserved] = useState<ReservedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancelBusyId, setCancelBusyId] = useState<string | null>(null);

  const favorites = useFavoritesStore((s) => s.entries);
  const loadFavorites = useFavoritesStore((s) => s.load);

  const reload = useCallback(() => {
    if (!loggedIn) return;
    setLoading(true);
    return api
      .get<{ taken: BackpackItem[]; reserved: ReservedItem[]; donated: BackpackItem[] }>(
        '/user/backpack',
      )
      .then((r) => {
        setTaken(r.data.taken);
        setDonated(r.data.donated);
        setReserved(r.data.reserved ?? []);
      })
      .catch(() => {
        setTaken([]);
        setDonated([]);
        setReserved([]);
      })
      .finally(() => setLoading(false));
  }, [loggedIn]);

  useEffect(() => {
    if (!loggedIn) return;
    void reload();
    void loadFavorites(true);
  }, [loggedIn, reload, loadFavorites]);

  const handleLasciaPrenotazione = async (reservationId: string) => {
    setCancelBusyId(reservationId);
    try {
      await api.delete(`/reservations/${reservationId}`);
      toast.info('Prenotazione lasciata');
      await reload();
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error ?? 'Operazione non riuscita'
        : 'Errore di rete';
      toast.error(msg);
    } finally {
      setCancelBusyId(null);
    }
  };

  if (!loggedIn) {
    return (
      <div className="page-content px-3 py-4 text-center">
        <h1 className="h5 fw-bold mb-3">Zaino</h1>
        <p className="text-muted mb-3">Accedi per vedere i libri presi, donati e preferiti.</p>
        <Link to="/entra" className="btn btn-libery btn-sm">
          Accedi
        </Link>
      </div>
    );
  }

  return (
    <div className="page-content px-3 py-3">
      <h1 className="h5 fw-bold mb-3">Zaino</h1>

      <div className="auth-tabs mb-3">
        <button
          type="button"
          className={`auth-tab ${tab === 'taken' ? 'active' : ''}`}
          onClick={() => setTab('taken')}
        >
          Presi{reserved.length > 0 && ` (${taken.length + reserved.length})`}
        </button>
        <button
          type="button"
          className={`auth-tab ${tab === 'donated' ? 'active' : ''}`}
          onClick={() => setTab('donated')}
        >
          Donati
        </button>
        <button
          type="button"
          className={`auth-tab ${tab === 'favorites' ? 'active' : ''}`}
          onClick={() => setTab('favorites')}
        >
          Preferiti
        </button>
      </div>

      {tab === 'taken' && (
        <p className="small text-muted mb-3">
          <strong>Lascia</strong>: scegli il punto (GPS entro pochi metri o cartello QR), confermi
          l&apos;ISBN del volume, poi il deposito.
        </p>
      )}

      {loading && tab !== 'favorites' && <p className="text-muted small">Caricamento…</p>}

      {tab === 'taken' && (
        <>
          {reserved.length === 0 && taken.length === 0 ? (
            <p className="text-muted small">Non hai ancora preso o prenotato libri.</p>
          ) : (
            <ul className="list-unstyled mb-0 book-card-list">
              {/* Prenotati in cima */}
              {reserved.map((r) => (
                <BookCard
                  key={`r-${r.id}`}
                  book={r.book}
                  linkState={BACK_STATE}
                  reserved={{
                    expiresAt: r.expiresAt,
                    pointId: r.point.id,
                    pointName: r.point.name,
                    pointAddress: addressLine(r.point),
                    actions: (
                      <button
                        type="button"
                        className="btn btn-libery-leave"
                        disabled={cancelBusyId === r.id}
                        onClick={() => void handleLasciaPrenotazione(r.id)}
                      >
                        {cancelBusyId === r.id ? '…' : 'Lascia'}
                      </button>
                    ),
                  }}
                />
              ))}

              {/* Libri effettivamente nello zaino */}
              {taken.map((item) => (
                <BookCard
                  key={item.id}
                  book={item.book}
                  linkState={BACK_STATE}
                  subtitle={
                    <>
                      Preso da {item.point.name}
                      {item.point.city && ` · ${item.point.city}`}
                      <span className="d-block">
                        {new Date(item.date).toLocaleDateString('it-IT')}
                      </span>
                    </>
                  }
                  actions={
                    <button
                      type="button"
                      className="btn btn-libery btn-sm"
                      onClick={() =>
                        openLeaveFromBackpack({
                          id: item.book.id,
                          isbn: item.book.isbn,
                          title: item.book.title,
                          author: item.book.author,
                        })
                      }
                    >
                      Lascia
                    </button>
                  }
                />
              ))}
            </ul>
          )}
        </>
      )}

      {tab === 'donated' && (
        donated.length === 0 ? (
          <p className="text-muted small">Non hai ancora donato libri.</p>
        ) : (
          <ul className="list-unstyled mb-0 book-card-list">
            {donated.map((item) => (
              <BookCard
                key={item.id}
                book={item.book}
                linkState={BACK_STATE}
                subtitle={
                  <>
                    Donato a {item.point.name}
                    {item.point.city && ` · ${item.point.city}`}
                    <span className="d-block">
                      {new Date(item.date).toLocaleDateString('it-IT')}
                    </span>
                  </>
                }
              />
            ))}
          </ul>
        )
      )}

      {tab === 'favorites' && (
        favorites.length === 0 ? (
          <p className="text-muted small">
            Nessun preferito. Tocca la stellina sulla scheda di un libro per aggiungerlo.
          </p>
        ) : (
          <ul className="list-unstyled mb-0 book-card-list">
            {favorites.map((item) => (
              <BookCard
                key={item.bookId}
                book={{
                  id: item.book.id,
                  title: item.book.title,
                  author: item.book.author ?? null,
                  isbn: item.book.isbn,
                  coverPath: item.book.coverPath ?? null,
                  year: item.book.year ?? null,
                }}
                linkState={BACK_STATE}
                subtitle={item.book.year ? String(item.book.year) : undefined}
                actions={
                  <FavoriteStar
                    bookId={item.book.id}
                    book={{
                      id: item.book.id,
                      isbn: item.book.isbn,
                      title: item.book.title,
                      author: item.book.author ?? null,
                      year: item.book.year ?? null,
                      genre: item.book.genre ?? null,
                      coverPath: item.book.coverPath ?? null,
                    }}
                    size={18}
                  />
                }
              />
            ))}
          </ul>
        )
      )}
    </div>
  );
}

/** Costruisce una stringa "indirizzo, città" usando i campi disponibili. */
function addressLine(point: PointLite): string {
  return [point.address, point.city].filter(Boolean).join(', ');
}
