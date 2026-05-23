import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { api } from '@/lib/api';
import BookListRow from '@/components/BookListRow';
import LiberyLoading from '@/components/LiberyLoading';
import UserPickupQrSheet from '@/components/UserPickupQrSheet';
import LiberyOutlinedSearchField from '@/components/LiberyOutlinedSearchField';
import type { ShellOutletContext } from '@/components/AppShell';
import { useAuthStore } from '@/stores/authStore';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { toast } from '@/stores/toastStore';
import { useSlotsStore } from '@/stores/slotsStore';
import LiberyNumChip from '@/components/LiberyNumChip';
import { MdNavigateButton } from '@/lib/material/md-react';

function matchesSearch(q: string, title: string, author: string | null | undefined): boolean {
  if (!q) return true;
  const norm = q.toLowerCase();
  return (
    title.toLowerCase().includes(norm) ||
    (author != null && author.toLowerCase().includes(norm))
  );
}

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

function pointSubtitle(point: PointLite, date: string, prefix: string) {
  return (
    <>
      {prefix} {point.name}
      {point.city ? ` · ${point.city}` : ''}
      <span className="d-block">{new Date(date).toLocaleDateString('it-IT')}</span>
    </>
  );
}

export default function BackpackPage() {
  const { setPageBar } = useOutletContext<ShellOutletContext>();
  const loggedIn = useAuthStore((s) => s.isLoggedIn());
  const [tab, setTab] = useState<BackpackTab>('taken');
  const [search, setSearch] = useState('');
  const [taken, setTaken] = useState<BackpackItem[]>([]);
  const [donated, setDonated] = useState<BackpackItem[]>([]);
  const [reserved, setReserved] = useState<ReservedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancelBusyId, setCancelBusyId] = useState<string | null>(null);
  const [qrTarget, setQrTarget] = useState<ReservedItem | null>(null);

  const favorites = useFavoritesStore((s) => s.entries);
  const loadFavorites = useFavoritesStore((s) => s.load);

  const ricevutiTotal = reserved.length + taken.length;

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
    if (!loggedIn) {
      setPageBar({
        title: 'Zaino',
        subtitle: 'Accedi per vedere libri ricevuti, donati e preferiti.',
        showBack: false,
      });
      return () => setPageBar(null);
    }
    setPageBar({ title: 'Zaino', showBack: false });
    return () => setPageBar(null);
  }, [loggedIn, setPageBar]);

  useEffect(() => {
    if (!loggedIn) return;
    void reload();
    void loadFavorites(true);
  }, [loggedIn, reload, loadFavorites]);

  const handleAnnullaPrenotazione = async (reservationId: string) => {
    setCancelBusyId(reservationId);
    try {
      await api.delete(`/reservations/${reservationId}`);
      toast.info('Prenotazione annullata');
      await reload();
      void useSlotsStore.getState().refreshSlots();
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
        <p className="text-muted mb-3">Serve un account Libery.</p>
        <MdNavigateButton to="/entra" color="outlined" size="small">
          Login
        </MdNavigateButton>
      </div>
    );
  }

  return (
    <div className="page-content px-3 py-3">
      <div role="tablist" aria-label="Sezioni zaino" className="libery-primary-tabs mb-3">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'taken'}
          tabIndex={tab === 'taken' ? 0 : -1}
          className="libery-primary-tab"
          onClick={() => { setTab('taken'); setSearch(''); }}
        >
          <span className="libery-primary-tab__label">Ricevuti</span>
          {ricevutiTotal > 0 ? <LiberyNumChip value={ricevutiTotal} hideZero /> : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'donated'}
          tabIndex={tab === 'donated' ? 0 : -1}
          className="libery-primary-tab"
          onClick={() => { setTab('donated'); setSearch(''); }}
        >
          <span className="libery-primary-tab__label">Donati</span>
          {donated.length > 0 ? <LiberyNumChip value={donated.length} hideZero /> : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'favorites'}
          tabIndex={tab === 'favorites' ? 0 : -1}
          className="libery-primary-tab"
          onClick={() => { setTab('favorites'); setSearch(''); }}
        >
          <span className="libery-primary-tab__label">Preferiti</span>
          {favorites.length > 0 ? <LiberyNumChip value={favorites.length} hideZero /> : null}
        </button>
      </div>

      <LiberyOutlinedSearchField
        label="Cerca titolo o autore…"
        value={search}
        onValueChange={setSearch}
        className="mb-3 w-100"
      />

      {loading && tab !== 'favorites' && <LiberyLoading variant="inline" />}

      {tab === 'taken' && (() => {
        const q = search.trim();
        const filteredReserved = reserved.filter((r) => matchesSearch(q, r.book.title, r.book.author));
        const filteredTaken = taken.filter((item) => matchesSearch(q, item.book.title, item.book.author));
        const noData = reserved.length === 0 && taken.length === 0;
        const noResults = !noData && filteredReserved.length === 0 && filteredTaken.length === 0;
        return (
          <>
            {noData ? (
              <p className="text-muted small">Non hai ancora ricevuto o prenotato libri.</p>
            ) : noResults ? (
              <p className="text-muted small">Nessun risultato per «{q}».</p>
            ) : (
              <div className="libery-book-list mb-0">
                {filteredReserved.map((r, ri) => {
                  const isLast = ri === filteredReserved.length - 1 && filteredTaken.length === 0;
                  return (
                    <BookListRow
                      key={`r-${r.id}`}
                      book={r.book}
                      linkState={BACK_STATE}
                      reserved={{
                        expiresAt: r.expiresAt,
                        pointName: r.point.name,
                        pointId: r.point.id,
                      }}
                      isLast={isLast}
                      menu={{
                        annullaPrenotazione: {
                          onClick: () => void handleAnnullaPrenotazione(r.id),
                          disabled: cancelBusyId === r.id,
                          busy: cancelBusyId === r.id,
                        },
                        prendi: { onClick: () => setQrTarget(r) },
                      }}
                    />
                  );
                })}
                {filteredTaken.map((item, ti) => (
                  <BookListRow
                    key={item.id}
                    book={item.book}
                    linkState={BACK_STATE}
                    subtitle={pointSubtitle(item.point, item.date, 'Ricevuto da')}
                    isLast={ti === filteredTaken.length - 1}
                  />
                ))}
              </div>
            )}
          </>
        );
      })()}

      {tab === 'donated' && (() => {
        const q = search.trim();
        const filtered = donated.filter((item) => matchesSearch(q, item.book.title, item.book.author));
        return donated.length === 0 ? (
          <p className="text-muted small">Non hai ancora donato libri in un punto.</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted small">Nessun risultato per «{q}».</p>
        ) : (
          <div className="libery-book-list mb-0">
            {filtered.map((item, di) => (
              <BookListRow
                key={item.id}
                book={item.book}
                linkState={BACK_STATE}
                subtitle={pointSubtitle(item.point, item.date, 'Donato a')}
                isLast={di === filtered.length - 1}
              />
            ))}
          </div>
        );
      })()}

      {tab === 'favorites' && (() => {
        const q = search.trim();
        const filtered = favorites.filter((item) => matchesSearch(q, item.book.title, item.book.author));
        return favorites.length === 0 ? (
          <p className="text-muted small">
            Nessun preferito. Usa il menu ⋮ o il cuore sulla scheda di un libro per salvarlo.
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-muted small">Nessun risultato per «{q}».</p>
        ) : (
          <div className="libery-book-list mb-0">
            {filtered.map((item, fi) => (
              <BookListRow
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
                isLast={fi === filtered.length - 1}
                menu={{
                  favorite: {
                    bookId: item.book.id,
                    book: {
                      id: item.book.id,
                      isbn: item.book.isbn,
                      title: item.book.title,
                      author: item.book.author ?? null,
                      year: item.book.year ?? null,
                      genre: item.book.genre ?? null,
                      coverPath: item.book.coverPath ?? null,
                    },
                  },
                }}
              />
            ))}
          </div>
        );
      })()}

      {qrTarget ? (
        <UserPickupQrSheet
          open={Boolean(qrTarget)}
          book={qrTarget.book}
          pointName={qrTarget.point.name}
          onOpenChange={(next) => {
            if (!next) setQrTarget(null);
          }}
          onVerified={() => {
            setQrTarget(null);
            toast.success('Ritiro completato!');
            void reload();
          }}
        />
      ) : null}
    </div>
  );
}
