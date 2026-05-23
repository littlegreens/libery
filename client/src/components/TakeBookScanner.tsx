import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import BarcodeScanner from '@/components/BarcodeScanner';
import CameraFlowScanFeedback from '@/components/CameraFlowScanFeedback';
import { cameraAlerts } from '@/lib/cameraAlerts';
import CameraFlowInfoMenu from '@/components/CameraFlowInfoMenu';
import BookCoverThumb from '@/components/BookCoverThumb';
import { api } from '@/lib/api';
import { formatDistanceKm, haversineKm, NEAR_POINT_KM, nearPointRadiusLabel } from '@/lib/geo';
import { classifyScan } from '@/lib/scanUtils';
import { LiberyButton, MdIcon, MdIconButton, MdTextField } from '@/lib/material/md-react';
import { toast } from '@/stores/toastStore';
import { useSlotsStore } from '@/stores/slotsStore';

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
  type LoadingPhase = 'idle' | 'reading' | 'fetching';
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>('idle');
  const loading = loadingPhase !== 'idle';
  const [manualIsbn, setManualIsbn] = useState('');
  const [gpsDenied, setGpsDenied] = useState(false);
  const [nearKm, setNearKm] = useState<number | null>(null);
  const busyRef = useRef(false);

  const reset = useCallback(() => {
    setPhase('verify');
    setLoadingPhase('idle');
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

  const gpsHintShownRef = useRef(false);
  useEffect(() => {
    if (!open || phase !== 'verify') {
      gpsHintShownRef.current = false;
      return;
    }
    const atPoint = nearKm != null && nearKm <= NEAR_POINT_KM;
    if (atPoint) {
      gpsHintShownRef.current = false;
      return;
    }
    if (gpsHintShownRef.current) return;
    gpsHintShownRef.current = true;
    if (gpsDenied) {
      toast.warning('GPS non disponibile: inquadra il cartello Libery del punto.', { duration: 6000 });
    } else if (nearKm != null && nearKm > NEAR_POINT_KM) {
      toast.warning(
        `Sei a ${formatDistanceKm(nearKm)}: avvicinati (entro ${nearPointRadiusLabel()}) o usa il cartello QR.`,
        { duration: 6000 },
      );
    } else {
      toast.info(
        `Per prendere il libro serve il GPS attivo (entro ${nearPointRadiusLabel()}) o il cartello QR.`,
        { duration: 6000 },
      );
    }
  }, [open, phase, nearKm, gpsDenied]);

  const confirmTake = async (isbn: string) => {
    if (busyRef.current) return;
    if (!isbnMatches(isbn, book.isbn)) {
      cameraAlerts.isbnNotRecognized();
      return;
    }
    busyRef.current = true;
    setLoadingPhase('fetching');
    try {
      const { data } = await api.post<{ message: string }>('/transactions/take', {
        pointId,
        isbn,
      });
      onSuccess?.(data.message);
      void useSlotsStore.getState().refreshSlots();
      handleClose();
    } catch {
      cameraAlerts.bookNotRecognized();
      busyRef.current = false;
    } finally {
      setLoadingPhase('idle');
    }
  };

  const handleScan = (text: string) => {
    const classified = classifyScan(text);
    if (!classified) {
      cameraAlerts.isbnNotRecognized();
      return;
    }

    if (phase === 'verify') {
      if (classified.kind !== 'qr') {
        toast.warning('Senza GPS attivo devi inquadrare il cartello Libery (QR), non l\'ISBN.');
        return;
      }
      setLoadingPhase('fetching');
      void (async () => {
        try {
          const { data } = await api.get<{ point: { id: string } }>(`/points/qr/${classified.value}`);
          if (data.point.id !== pointId) {
            cameraAlerts.bookNotRecognized();
            return;
          }
          setPhase('isbn');
        } catch {
          cameraAlerts.bookNotRecognized();
        } finally {
          setLoadingPhase('idle');
        }
      })();
      return;
    }

    if (classified.kind !== 'isbn') {
      cameraAlerts.isbnNotRecognized();
      return;
    }
    setLoadingPhase('reading');
    void confirmTake(classified.value);
  };

  const submitManual = () => {
    const classified = classifyScan(manualIsbn.trim());
    if (!classified || classified.kind !== 'isbn') {
      cameraAlerts.isbnNotRecognized();
      return;
    }
    setLoadingPhase('reading');
    void confirmTake(classified.value);
  };

  if (!open) return null;

  const showScanner = phase === 'isbn' || phase === 'verify';
  const scanMode = phase === 'verify' ? 'qr' : 'isbn';

  return (
    <div className="camera-flow camera-flow--app take-book-scanner" role="dialog" aria-modal="true">
      <header className="camera-flow-app-header">
        <MdIconButton type="button" aria-label="Chiudi" onClick={handleClose}>
          <MdIcon>close</MdIcon>
        </MdIconButton>
        <span className="camera-flow-app-title">
          {phase === 'verify' ? 'Ricevi — conferma punto' : 'Ricevi — conferma ISBN'}
        </span>
        <div className="camera-flow-app-header__spacer" aria-hidden />
        <CameraFlowInfoMenu
          variant="take"
          phaseHint={
            phase === 'verify'
              ? 'Inquadra il cartello Libery con il QR.'
              : "Inquadra il codice a barre dell'ISBN sul volume."
          }
        />
      </header>

      {showScanner && (
        <div
          className={`camera-flow-scanner-wrap ${
            'camera-flow-scanner-wrap--isbn'
          }`}
        >
          <BarcodeScanner
            active={showScanner}
            paused={loadingPhase !== 'idle'}
            mode={scanMode}
            onScan={handleScan}
            onError={(msg) => toast.warning(msg)}
          />
        </div>
      )}

      <CameraFlowScanFeedback loadingPhase={loadingPhase} />

      <div className="camera-flow-body">
        <section className="camera-flow-card camera-flow-book-hero mb-3">
          <div className="d-flex gap-3 align-items-start">
            <BookCoverThumb
              title={book.title}
              isbn={book.isbn}
              coverPath={book.coverPath}
              coverSize="sheet"
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

        {phase === 'verify' && nearKm != null && nearKm <= NEAR_POINT_KM && (
          <section className="camera-flow-card mb-3">
            <p className="small text-muted mb-0">Posizione verificata via GPS.</p>
          </section>
        )}
        {phase === 'verify' && (nearKm == null || nearKm > NEAR_POINT_KM) && (
          <section className="camera-flow-card mb-3">
            <LiberyButton type="button" color="tonal" size="small" onClick={tryGps}>
              Riprova GPS
            </LiberyButton>
          </section>
        )}

        {phase === 'isbn' && (
          <section className="camera-flow-manual-isbn">
            <label className="camera-flow-manual-label" htmlFor="take-manual-isbn">
              Oppure digita l&apos;ISBN
            </label>
            <div className="camera-flow-manual-row align-items-start">
              <MdTextField
                id="take-manual-isbn"
                label="ISBN"
                type="text"
                inputMode="numeric"
                autocomplete="off"
                placeholder="9788806211778"
                value={manualIsbn}
                disabled={loading}
                style={{ flex: '1 1 auto', minWidth: 0 }}
                onInput={(e: Event) =>
                  setManualIsbn((e.currentTarget as HTMLElement & { value: string }).value)
                }
                onKeyDown={(e: KeyboardEvent) => {
                  if (e.key === 'Enter') submitManual();
                }}
              />
              <LiberyButton
                type="button"
                color="filled"
                size="small"
                style={{ alignSelf: 'center' }}
                onClick={submitManual}
                disabled={loading || !manualIsbn.trim()}
              >
                OK
              </LiberyButton>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
