import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import BarcodeScanner from '@/components/BarcodeScanner';
import BookCoverThumb from '@/components/BookCoverThumb';
import { api } from '@/lib/api';
import { formatDistanceKm, haversineKm, NEAR_POINT_KM, nearPointRadiusLabel } from '@/lib/geo';
import { classifyScan } from '@/lib/scanUtils';

type BookTarget = {
  id: string;
  isbn: string;
  title: string;
  author: string | null;
  coverPath?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  pointId: string;
  pointName: string;
  latitude?: number | null;
  longitude?: number | null;
  book: BookTarget;
  onSuccess?: (message: string) => void;
};

type Phase = 'verify' | 'isbn';

function isbnMatches(scanned: string, expected: string): boolean {
  const a = scanned.replace(/\D/g, '');
  const b = expected.replace(/\D/g, '');
  if (a === b) return true;
  if (a.length === 13 && b.length === 10 && a.endsWith(b.slice(0, 9))) return true;
  if (b.length === 13 && a.length === 10 && b.endsWith(a.slice(0, 9))) return true;
  return false;
}

export default function TakeBookScanner({
  open,
  onClose,
  pointId,
  pointName,
  latitude,
  longitude,
  book,
  onSuccess,
}: Props) {
  const [phase, setPhase] = useState<Phase>('verify');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [manualIsbn, setManualIsbn] = useState('');
  const [gpsDenied, setGpsDenied] = useState(false);
  const [nearKm, setNearKm] = useState<number | null>(null);
  const busyRef = useRef(false);

  const reset = useCallback(() => {
    setPhase('verify');
    setError('');
    setLoading(false);
    setManualIsbn('');
    setGpsDenied(false);
    setNearKm(null);
    busyRef.current = false;
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const tryGps = useCallback(() => {
    if (latitude == null || longitude == null || !navigator.geolocation) {
      setGpsDenied(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const km = haversineKm(pos.coords.latitude, pos.coords.longitude, latitude, longitude);
        setNearKm(km);
        setGpsDenied(false);
        if (km <= NEAR_POINT_KM) {
          setPhase('isbn');
          setError('');
        }
      },
      () => setGpsDenied(true),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [latitude, longitude]);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    tryGps();
  }, [open, reset, tryGps]);

  const confirmTake = async (isbn: string) => {
    if (busyRef.current) return;
    if (!isbnMatches(isbn, book.isbn)) {
      setError('ISBN non corrisponde a questo libro. Inquadra il codice sul volume scelto.');
      return;
    }
    busyRef.current = true;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post<{ message: string }>('/transactions/take', {
        pointId,
        isbn,
      });
      onSuccess?.(data.message);
      handleClose();
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error ?? 'Non è stato possibile prendere il libro'
        : 'Errore di rete';
      setError(msg);
      busyRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  const handleScan = (text: string) => {
    const classified = classifyScan(text);
    if (!classified) {
      setError(
        phase === 'verify'
          ? 'Inquadra il cartello Libery nel punto.'
          : "Inquadra il codice a barre dell'ISBN sul libro.",
      );
      return;
    }

    if (phase === 'verify') {
      if (classified.kind !== 'qr') {
        setError('Senza GPS attivo devi inquadrare il cartello Libery (QR), non l\'ISBN.');
        return;
      }
      setLoading(true);
      void (async () => {
        try {
          const { data } = await api.get<{ point: { id: string } }>(`/points/qr/${classified.value}`);
          if (data.point.id !== pointId) {
            setError('Questo cartello non corrisponde a questo punto.');
            return;
          }
          setPhase('isbn');
          setError('');
        } catch {
          setError('Cartello non riconosciuto');
        } finally {
          setLoading(false);
        }
      })();
      return;
    }

    if (classified.kind !== 'isbn') {
      setError("Inquadra il codice a barre dell'ISBN sul libro.");
      return;
    }
    void confirmTake(classified.value);
  };

  const submitManual = () => {
    const classified = classifyScan(manualIsbn.trim());
    if (!classified || classified.kind !== 'isbn') {
      setError('Inserisci un ISBN valido');
      return;
    }
    void confirmTake(classified.value);
  };

  if (!open) return null;

  const showScanner = phase === 'isbn' || phase === 'verify';
  const scanMode = phase === 'verify' ? 'qr' : 'isbn';

  return (
    <div className="camera-flow camera-flow--app take-book-scanner" role="dialog" aria-modal="true">
      <header className="camera-flow-app-header">
        <button type="button" className="btn-close" onClick={handleClose} aria-label="Chiudi" />
        <span className="camera-flow-app-title">
          {phase === 'verify' ? 'Prendi — conferma punto' : 'Prendi — conferma ISBN'}
        </span>
      </header>

      {showScanner && (
        <div
          className={`camera-flow-scanner-wrap ${
            'camera-flow-scanner-wrap--isbn'
          }`}
        >
          <BarcodeScanner active={!loading} mode={scanMode} onScan={handleScan} onError={setError} />
          <p className="camera-flow-hint">
            {phase === 'verify'
              ? 'Inquadra il cartello Libery'
              : "Inquadra il codice a barre dell'ISBN"}
          </p>
        </div>
      )}

      <div className="camera-flow-body">
        <section className="camera-flow-card camera-flow-book-hero mb-3">
          <div className="d-flex gap-3 align-items-start">
            <BookCoverThumb
              title={book.title}
              isbn={book.isbn}
              coverPath={book.coverPath}
              size={64}
            />
            <div className="min-w-0">
              <h3 className="camera-flow-book-title h6 mb-1">{book.title}</h3>
              {book.author && <p className="small text-muted mb-1">{book.author}</p>}
              <p className="small text-muted mb-0">
                A <strong>{pointName}</strong>
                {phase === 'isbn' ? ' — dopo la scansione va nel tuo zaino.' : '.'}
              </p>
            </div>
          </div>
        </section>

        {phase === 'verify' && (
          <section className="camera-flow-card mb-3">
            {nearKm != null && nearKm <= NEAR_POINT_KM ? (
              <p className="small text-muted mb-0">Posizione verificata via GPS.</p>
            ) : (
              <>
                <p className="small text-muted mb-2">
                  Per prendere un libro serve essere nel punto: <strong>GPS attivo</strong> (entro{' '}
                  {nearPointRadiusLabel()}) oppure <strong>cartello QR</strong>. Non ci sono altri modi.
                </p>
                {gpsDenied && (
                  <p className="small text-muted mb-2">
                    GPS non disponibile — inquadra il cartello Libery qui sotto.
                  </p>
                )}
                {nearKm != null && nearKm > NEAR_POINT_KM && (
                  <p className="small text-muted mb-2">
                    Sei a {formatDistanceKm(nearKm)}: avvicinati (entro {nearPointRadiusLabel()}) o usa il
                    cartello QR.
                  </p>
                )}
                <button type="button" className="btn btn-libery-soft btn-sm" onClick={tryGps}>
                  Riprova GPS
                </button>
              </>
            )}
          </section>
        )}

        {error && <p className="camera-flow-error">{error}</p>}
        {loading && <p className="camera-flow-status">Elaborazione…</p>}

        {phase === 'isbn' && (
          <section className="camera-flow-manual-isbn">
            <label className="camera-flow-manual-label" htmlFor="take-manual-isbn">
              Oppure digita l&apos;ISBN
            </label>
            <div className="camera-flow-manual-row">
              <input
                id="take-manual-isbn"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                className="camera-flow-manual-input"
                placeholder="9788806211778"
                value={manualIsbn}
                onChange={(e) => setManualIsbn(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitManual();
                }}
                disabled={loading}
              />
              <button
                type="button"
                className="btn btn-libery btn-sm"
                onClick={submitManual}
                disabled={loading || !manualIsbn.trim()}
              >
                OK
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
