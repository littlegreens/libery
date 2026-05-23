import { FormEvent, useCallback, useEffect, useState } from 'react';
import { toast } from '@/stores/toastStore';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { api } from '@/lib/api';
import type { ShellOutletContext } from '@/components/AppShell';
import { useAuthStore } from '@/stores/authStore';
import LiberyLoading from '@/components/LiberyLoading';
import PointTypeBadge from '@/components/PointTypeBadge';
import BarcodeScanner from '@/components/BarcodeScanner';
import CameraFlowScanFeedback from '@/components/CameraFlowScanFeedback';
import { cameraAlerts } from '@/lib/cameraAlerts';
import { classifyScan } from '@/lib/scanUtils';
import BookCoverThumb from '@/components/BookCoverThumb';
import { MdIcon } from '@/lib/material/md-react';
import type { PointType } from '@/types/point';
import { LiberyButton, MdTextField } from '@/lib/material/md-react';

type ManagerPoint = {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  type: PointType;
  isManager?: boolean;
};

type StaffRow = {
  id: string;
  user: { id: string; email: string; displayName: string | null; role: string };
};

type InventoryBook = {
  pointBookId: string;
  bookId: string;
  isbn: string;
  title: string;
  author: string | null;
  coverPath: string | null;
  copies: number;
};

export default function ManagerPage() {
  const { setPageBar } = useOutletContext<ShellOutletContext>();
  const myRole = useAuthStore((s) => s.user?.role);
  const [point, setPoint] = useState<ManagerPoint | null>(null);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [staffEmail, setStaffEmail] = useState('');
  const [staffMsg, setStaffMsg] = useState('');
  const [tab, setTab] = useState<'books' | 'staff'>('books');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Inventario libri
  const [books, setBooks] = useState<InventoryBook[]>([]);
  const [booksLoading, setBooksLoading] = useState(false);
  const [booksError, setBooksError] = useState('');
  // Modifiche locali (bookId -> nuove copie), salvate solo con "Salva"
  const [pendingCopies, setPendingCopies] = useState<Record<string, number>>({});
  const [saveBusy, setSaveBusy] = useState(false);

  // Aggiungi libri (scan rapido ISBN)
  const [addMode, setAddMode] = useState(false);
  const [addScannerActive, setAddScannerActive] = useState(false);
  type AddScanPhase = 'idle' | 'reading' | 'fetching';
  const [addScanPhase, setAddScanPhase] = useState<AddScanPhase>('idle');
  const addBusy = addScanPhase !== 'idle';
  const [addMsg, setAddMsg] = useState('');

  const canManageStaff = myRole === 'admin' || myRole === 'point_manager';

  const loadStaff = useCallback(async () => {
    if (!canManageStaff) return;
    try {
      const { data } = await api.get<{ staff: StaffRow[] }>('/manager/staff');
      setStaff(data.staff);
    } catch {
      setStaff([]);
    }
  }, [canManageStaff]);

  const loadBooks = useCallback(async () => {
    setBooksLoading(true);
    setBooksError('');
    try {
      const { data } = await api.get<{ books: InventoryBook[] }>('/manager/books');
      setBooks(data.books);
    } catch {
      setBooksError('Impossibile caricare i libri');
    } finally {
      setBooksLoading(false);
    }
  }, []);

  const setCopiesLocal = (bookId: string, newVal: number) => {
    setPendingCopies((p) => ({ ...p, [bookId]: Math.max(0, newVal) }));
  };

  const removeLocal = (bookId: string) => {
    setPendingCopies((p) => ({ ...p, [bookId]: 0 }));
  };

  const saveChanges = async () => {
    const entries = Object.entries(pendingCopies);
    if (entries.length === 0) return;
    setSaveBusy(true);
    setBooksError('');
    try {
      await Promise.all(
        entries.map(([bookId, copies]) =>
          api.patch(`/manager/books/${bookId}`, { copies }),
        ),
      );
      setBooks((prev) =>
        prev
          .map((b) => (pendingCopies[b.bookId] !== undefined ? { ...b, copies: pendingCopies[b.bookId] } : b))
          .filter((b) => b.copies > 0),
      );
      setPendingCopies({});
    } catch {
      setBooksError('Errore nel salvataggio');
    } finally {
      setSaveBusy(false);
    }
  };

  const handleAddIsbn = async (isbn: string) => {
    if (addBusy) return;
    setAddScanPhase('fetching');
    setAddMsg('');
    try {
      const { data } = await api.post<{
        book: { id: string; isbn: string; title: string; author: string | null; coverPath: string | null };
        copies: number;
        added: boolean;
      }>('/manager/add-book', { isbn });
      setBooks((prev) => {
        const existing = prev.find((b) => b.bookId === data.book.id);
        if (existing) return prev.map((b) => (b.bookId === data.book.id ? { ...b, copies: data.copies } : b));
        return [
          ...prev,
          {
            pointBookId: '',
            bookId: data.book.id,
            isbn: data.book.isbn,
            title: data.book.title,
            author: data.book.author,
            coverPath: data.book.coverPath,
            copies: data.copies,
          },
        ];
      });
      // Chiudi il pannello scanner e mostra la lista aggiornata
      setAddMode(false);
      setAddScannerActive(false);
      toast.success(`"${data.book.title}" aggiunto in libreria`);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        cameraAlerts.bookNotFound();
      } else {
        cameraAlerts.bookNotRecognized();
      }
      setAddMsg('');
    } finally {
      setAddScanPhase('idle');
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<{ point: ManagerPoint }>('/manager/point');
      setPoint(data.point);
    } catch (err) {
      const serverMsg = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error
        : undefined;
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (status === 403) {
        setError('Sessione non aggiornata. Esci e accedi di nuovo per aggiornare il ruolo.');
      } else {
        setError(serverMsg ?? 'Impossibile caricare il punto assegnato');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (canManageStaff) void loadStaff();
  }, [canManageStaff, loadStaff]);

  useEffect(() => {
    if (tab === 'books' && point) void loadBooks();
  }, [tab, point, loadBooks]);

  useEffect(() => {
    setPageBar({
      title: tab === 'books' ? 'Inventario libri' : 'Addetti',
      showBack: false,
    });
    return () => setPageBar(null);
  }, [setPageBar, tab]);


  async function handleAddStaff(e: FormEvent) {
    e.preventDefault();
    setStaffMsg('');
    try {
      await api.post('/manager/staff', { email: staffEmail.trim() });
      setStaffEmail('');
      setStaffMsg('Addetto abilitato (email con password se nuovo account).');
      await loadStaff();
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error ?? 'Errore'
        : 'Errore di rete';
      setStaffMsg(msg);
    }
  }

  async function removeStaff(userId: string) {
    setStaffMsg('');
    try {
      await api.delete(`/manager/staff/${userId}`);
      await loadStaff();
    } catch {
      setStaffMsg('Rimozione non riuscita');
    }
  }

  const isDirty = Object.keys(pendingCopies).length > 0;

  return (
    <div className="page-content manager-page px-3 py-3">
      {loading && <LiberyLoading variant="page" />}
      {error && <p className="camera-flow-error mb-2">{error}</p>}

      {point && (
        <section className="manager-point-info mb-3">
          <div className="d-flex align-items-center gap-2 mb-1">
            <PointTypeBadge type={point.type} />
          </div>
          <h2 className="h6 fw-bold mb-0">{point.name}</h2>
          {(point.address || point.city) && (
            <p className="small text-muted mb-0">
              {[point.address, point.city].filter(Boolean).join(' · ')}
            </p>
          )}
        </section>
      )}

      <div className="d-flex gap-2 mb-3 flex-wrap">
        <LiberyButton
          type="button"
          size="small"
          variant={tab === 'books' ? 'primary' : 'secondary'}
          onClick={() => { setTab('books'); setAddMode(false); setPendingCopies({}); }}
        >
          Libri
        </LiberyButton>
        {canManageStaff && (
          <LiberyButton
            type="button"
            size="small"
            variant={tab === 'staff' ? 'primary' : 'secondary'}
            onClick={() => { setTab('staff'); setAddMode(false); setPendingCopies({}); }}
          >
            Addetti
          </LiberyButton>
        )}
      </div>

      {tab === 'staff' && canManageStaff && (
        <section className="camera-flow-card mb-3">
          <h2 className="h6 fw-bold mb-2">Addetti al punto</h2>
          <p className="small text-muted">
            Gli addetti possono validare consegne e ritiri con la fotocamera, come te.
          </p>
          <form onSubmit={handleAddStaff} className="mb-3">
            <MdTextField
              style={{ width: '100%' }}
              className="mb-2"
              label="Email addetto"
              type="email"
              value={staffEmail}
              required
              onInput={(e: Event) =>
                setStaffEmail((e.currentTarget as HTMLElement & { value: string }).value)
              }
            />
            <LiberyButton type="button" variant="primary" size="small" onClick={() => void handleAddStaff({ preventDefault: () => {} } as FormEvent)}>
              Abilita
            </LiberyButton>
          </form>
          {staffMsg ? <p className="small mb-2">{staffMsg}</p> : null}
          <ul className="list-unstyled small mb-0">
            {staff.map((s) => (
              <li key={s.id} className="d-flex justify-content-between align-items-center mb-2">
                <span>
                  {s.user.displayName ?? s.user.email}
                  <span className="text-muted"> · {s.user.email}</span>
                </span>
                <LiberyButton type="button" variant="secondary" size="small" onClick={() => void removeStaff(s.user.id)}>
                  Rimuovi
                </LiberyButton>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'books' && (
        <section>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <span className="small text-muted">
              {books.length} titol{books.length === 1 ? 'o' : 'i'} in libreria
            </span>
            {!addMode && (
              <LiberyButton
                type="button"
                size="small"
                variant="primary"
                onClick={() => { setAddMode(true); setAddScannerActive(true); setAddMsg(''); }}
              >
                <MdIcon slot="icon">add</MdIcon>
                Aggiungi libri
              </LiberyButton>
            )}
          </div>

          {addMode && (
            <div className="camera-flow-card mb-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="fw-semibold small">Scan ISBN rapido</span>
                <LiberyButton
                  type="button"
                  size="small"
                  variant="secondary"
                  onClick={() => { setAddMode(false); setAddScannerActive(false); setAddMsg(''); }}
                >
                  Fine
                </LiberyButton>
              </div>
              <div className="manager-scan-viewport camera-flow-scanner-wrap mb-2">
                <BarcodeScanner
                  active={addScannerActive}
                  paused={addScanPhase !== 'idle'}
                  mode="isbn"
                  onScan={(text) => {
                    const classified = classifyScan(text);
                    if (!classified || classified.kind !== 'isbn') {
                      cameraAlerts.isbnNotRecognized();
                      return;
                    }
                    setAddScanPhase('reading');
                    void handleAddIsbn(classified.value);
                  }}
                  showCaptureControls
                />
              </div>
              <CameraFlowScanFeedback loadingPhase={addScanPhase} />
              {addMsg && (
                <p className={`small mb-0 ${addMsg.startsWith('Errore') ? 'text-danger' : 'text-success'}`}>
                  {addMsg}
                </p>
              )}
            </div>
          )}

          {booksError && <p className="camera-flow-error mb-2">{booksError}</p>}
          {booksLoading && <LiberyLoading variant="page" />}

          {!booksLoading && books.length === 0 && !booksError && (
            <p className="small text-muted text-center py-3">
              Nessun libro in inventario. Usa «Aggiungi libri» per scannerizzare ISBN.
            </p>
          )}

          <ul className="list-unstyled mb-0">
            {books.map((b) => {
              const displayCopies = pendingCopies[b.bookId] ?? b.copies;
              const isRemoved = displayCopies === 0;
              return (
                <li key={b.bookId} className={`manager-book-row${isRemoved ? ' manager-book-row--removed' : ''}`}>
                  <BookCoverThumb
                    title={b.title}
                    isbn={b.isbn}
                    coverPath={b.coverPath}
                    coverSize="list"
                  />
                  <div className="manager-book-row__info min-w-0">
                    <p className="manager-book-row__title">{b.title}</p>
                    {b.author && <p className="manager-book-row__author">{b.author}</p>}
                  </div>
                  <div className="manager-book-row__actions">
                    <button
                      type="button"
                      className="manager-copies-btn"
                      disabled={displayCopies <= 0}
                      aria-label="Riduci copie"
                      onClick={() => setCopiesLocal(b.bookId, displayCopies - 1)}
                    >
                      <MdIcon>remove</MdIcon>
                    </button>
                    <span className={`manager-copies-count${isRemoved ? ' manager-copies-count--zero' : ''}`}>
                      {isRemoved ? 'Rimosso' : displayCopies}
                    </span>
                    <button
                      type="button"
                      className="manager-copies-btn"
                      aria-label="Aumenta copie"
                      onClick={() => setCopiesLocal(b.bookId, displayCopies + 1)}
                    >
                      <MdIcon>add</MdIcon>
                    </button>
                    <button
                      type="button"
                      className="manager-copies-btn manager-copies-btn--remove"
                      aria-label="Rimuovi libro"
                      onClick={() => removeLocal(b.bookId)}
                    >
                      <MdIcon>delete_outline</MdIcon>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {isDirty && (
            <div className="manager-save-bar">
              <LiberyButton
                type="button"
                variant="secondary"
                size="small"
                disabled={saveBusy}
                onClick={() => setPendingCopies({})}
              >
                Annulla
              </LiberyButton>
              <LiberyButton
                type="button"
                variant="primary"
                size="small"
                disabled={saveBusy}
                onClick={() => void saveChanges()}
              >
                {saveBusy ? 'Salvataggio…' : 'Salva'}
              </LiberyButton>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
