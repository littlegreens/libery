import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { api } from '@/lib/api';
import { classifyScan } from '@/lib/scanUtils';
import BarcodeScanner from '@/components/BarcodeScanner';
import CameraBookPreview from '@/components/CameraBookPreview';
import { logBookResolveToConsole } from '@/lib/logBookResolve';
import { formatDistanceKm, haversineKm, NEAR_POINT_KM, nearPointRadiusLabel } from '@/lib/geo';
import { POINT_TYPE_LABELS } from '@/lib/mapIcons';
import type { LeaveBackpackBook } from '@/components/AppShell';
import type { MapPoint, PointType } from '@/types/point';

type BookInfo = {
  id: string;
  isbn: string;
  title: string;
  author: string | null;
  year?: number | null;
  genre?: string | null;
  description?: string | null;
  coverPath?: string | null;
};

type PointInfo = {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  type: string;
};

type Phase =
  | 'confirm_near'
  | 'scan_detect'
  | 'scan_isbn'
  | 'book_preview'
  | 'scan_point_qr'
  | 'actions'
  | 'done';
type PointPickMode = 'idle' | 'scan_qr';
type FlowMode = 'full' | 'leave_here' | 'leave_backpack';

function isbnMatches(scanned: string, expected: string): boolean {
  const a = scanned.replace(/\D/g, '');
  const b = expected.replace(/\D/g, '');
  if (a === b) return true;
  if (a.length === 13 && b.length === 10 && a.endsWith(b.slice(0, 9))) return true;
  if (b.length === 13 && a.length === 10 && b.endsWith(a.slice(0, 9))) return true;
  return false;
}

type Props = {
  open: boolean;
  onClose: () => void;
  /** Se aperto dalla scheda /punto/:id â€” flusso â€œlascio quiâ€ con conferma sede */
  contextPointId?: string | null;
  /** Libro dallo zaino: scegli punto vicino (GPS/QR) e conferma ISBN */
  leaveBackpackBook?: LeaveBackpackBook | null;
};

const STEPS: { key: Phase; label: string }[] = [
  { key: 'scan_detect', label: 'Inquadra' },
  { key: 'book_preview', label: 'Libro' },
  { key: 'scan_point_qr', label: 'Punto' },
  { key: 'actions', label: 'Azione' },
];

function toPointInfo(p: MapPoint): PointInfo {
  return {
    id: p.id,
    name: p.name,
    city: p.city,
    address: p.address,
    type: p.type,
  };
}

function formatPointLine(p: PointInfo): string {
  return [p.address, p.city].filter(Boolean).join(', ');
}

function stepIndex(phase: Phase, flowMode: FlowMode): number {
  if (flowMode === 'leave_here') {
    if (phase === 'confirm_near') return 0;
    if (phase === 'scan_isbn' || phase === 'book_preview') return 1;
    return 2;
  }
  if (flowMode === 'leave_backpack') {
    if (phase === 'scan_point_qr') return 0;
    if (phase === 'scan_isbn' || phase === 'book_preview') return 1;
    return 2;
  }
  if (phase === 'scan_detect' || phase === 'scan_isbn') return 0;
  if (phase === 'book_preview') return 1;
  if (phase === 'scan_point_qr') return 2;
  return 3;
}

export default function CameraFlow({ open, onClose, contextPointId, leaveBackpackBook }: Props) {
  const [flowMode, setFlowMode] = useState<FlowMode>('full');
  const [nearKm, setNearKm] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('scan_detect');
  const [pointPickMode, setPointPickMode] = useState<PointPickMode>('idle');
  const [point, setPoint] = useState<PointInfo | null>(null);
  const [book, setBook] = useState<BookInfo | null>(null);
  const [allPoints, setAllPoints] = useState<MapPoint[]>([]);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsDenied, setGpsDenied] = useState(false);
  const [availability, setAvailability] = useState<{
    available: boolean;
    copies: number;
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanHint, setScanHint] = useState('');
  const [bookProvider, setBookProvider] = useState<'google' | 'openlibrary' | 'wikidata' | 'db' | null>(
    null,
  );
  const [manualIsbn, setManualIsbn] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const loadingRef = useRef(false);
  const processingIsbnRef = useRef(false);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const reset = useCallback(() => {
    setFlowMode('full');
    setNearKm(null);
    setPhase('scan_detect');
    setPointPickMode('idle');
    setPoint(null);
    setBook(null);
    setAllPoints([]);
    setUserPos(null);
    setGpsDenied(false);
    setAvailability(null);
    setMessage('');
    setError('');
    setScanHint('');
    setBookProvider(null);
    setManualIsbn('');
    setLoading(false);
    processingIsbnRef.current = false;
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  useEffect(() => {
    if (!open) return;

    if (leaveBackpackBook) {
      setFlowMode('leave_backpack');
      setBook({
        id: leaveBackpackBook.id,
        isbn: leaveBackpackBook.isbn,
        title: leaveBackpackBook.title,
        author: leaveBackpackBook.author,
      });
      setPhase('scan_point_qr');
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            setGpsDenied(false);
          },
          () => setGpsDenied(true),
          { enableHighAccuracy: true, timeout: 10000 },
        );
      } else {
        setGpsDenied(true);
      }
      return;
    }

    if (!contextPointId) {
      setFlowMode('full');
      setPhase('scan_detect');
      void loadPointsCatalog();
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            setGpsDenied(false);
          },
          () => setGpsDenied(true),
          { enableHighAccuracy: true, timeout: 10000 },
        );
      }
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const { data } = await api.get<{ point: MapPoint }>(`/points/${contextPointId}`);
        if (cancelled) return;
        const pinfo = toPointInfo(data.point);
        setPoint(pinfo);
        setFlowMode('leave_here');
        setPhase('confirm_near');

        if (navigator.geolocation && data.point.latitude != null && data.point.longitude != null) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (cancelled) return;
              const km = haversineKm(
                pos.coords.latitude,
                pos.coords.longitude,
                data.point.latitude!,
                data.point.longitude!,
              );
              setNearKm(km);
              setGpsDenied(false);
            },
            () => {
              if (!cancelled) setGpsDenied(true);
            },
            { enableHighAccuracy: false, timeout: 8000 },
          );
        }
      } catch {
        if (!cancelled) {
          setError('Impossibile caricare il punto');
          setFlowMode('full');
          setPhase('scan_detect');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, contextPointId, leaveBackpackBook]);

  const loadBook = async (
    isbn: string,
  ): Promise<{ book: BookInfo; provider?: 'google' | 'openlibrary' | 'wikidata' | 'db' }> => {
    const { data } = await api.get<{
      book: BookInfo;
      source: string;
      created: boolean;
      provider?: 'google' | 'openlibrary' | 'wikidata' | 'db';
      fieldsUpdated?: string[];
      attempts?: Array<{ source: string; status: string; detail?: string }>;
      debug?: {
        googleBooksConfigured?: boolean;
        coverInDb?: boolean;
        coverSentToClient?: boolean;
        coverFallbackUsed?: boolean;
        sources?: Record<
          string,
          {
            title: string | null;
            author: string | null;
            descriptionLen: number;
            cover: string | null;
            year: number | null;
          } | null
        >;
      };
    }>(`/books/isbn/${isbn}`, { params: { debug: '1' } });

    logBookResolveToConsole(isbn, data);

    return {
      book: { ...data.book, isbn },
      provider: data.provider ?? 'db',
    };
  };

  const checkAvailability = async (pointId: string, isbn: string) => {
    const { data } = await api.get<{
      available: boolean;
      copies: number;
      message: string;
      book: BookInfo | null;
    }>(`/points/${pointId}/availability/${isbn}`);
    setAvailability({
      available: data.available,
      copies: data.copies,
      message: data.message,
    });
    if (data.book) {
      setBook((prev) => ({
        ...(prev ?? data.book!),
        ...data.book!,
        isbn,
      }));
    }
  };

  const loadPointsCatalog = useCallback(async () => {
    try {
      const { data } = await api.get<{ points: MapPoint[] }>('/points', {
        params: { status: 'approved' },
      });
      setAllPoints(data.points);
    } catch {
      setAllPoints([]);
    }
  }, []);

  useEffect(() => {
    if (open && phase === 'scan_point_qr' && !userPos) {
      setPointPickMode('scan_qr');
    }
  }, [open, phase, userPos]);

  useEffect(() => {
    if (!open || phase !== 'scan_point_qr') return;
    void loadPointsCatalog();

    if (!navigator.geolocation) {
      setGpsDenied(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsDenied(false);
      },
      () => setGpsDenied(true),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }, [open, phase, loadPointsCatalog]);

  const nearbyPoints = useMemo(() => {
    if (!userPos) return [];
    return allPoints
      .filter((p) => p.latitude != null && p.longitude != null)
      .map((p) => ({
        point: p,
        km: haversineKm(userPos.lat, userPos.lng, p.latitude!, p.longitude!),
      }))
      .filter((x) => x.km <= NEAR_POINT_KM)
      .sort((a, b) => a.km - b.km)
      .slice(0, 8);
  }, [allPoints, userPos]);

  const autoDetectPoint = useCallback(
    async (b: BookInfo) => {
      if (!navigator.geolocation) {
        setGpsDenied(true);
        return;
      }
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          });
        });
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPos(coords);
        setGpsDenied(false);

        let points = allPoints;
        if (points.length === 0) {
          const { data } = await api.get<{ points: MapPoint[] }>('/points', {
            params: { status: 'approved' },
          });
          points = data.points;
          setAllPoints(points);
        }

        let best: { point: MapPoint; km: number } | null = null;
        for (const p of points) {
          if (p.latitude == null || p.longitude == null) continue;
          const km = haversineKm(coords.lat, coords.lng, p.latitude, p.longitude);
          if (km <= NEAR_POINT_KM && (!best || km < best.km)) {
            best = { point: p, km };
          }
        }
        if (best) {
          setPoint(toPointInfo(best.point));
          setNearKm(best.km);
          await checkAvailability(best.point.id, b.isbn);
        }
      } catch {
        setGpsDenied(true);
      }
    },
    [allPoints, checkAvailability],
  );

  const applyBookIsbn = useCallback(async (isbn: string) => {
    if (processingIsbnRef.current) return;
    processingIsbnRef.current = true;
    setScanHint('Recupero informazioni…');
    setError('');
    setBook(null);
    setBookProvider(null);
    setLoading(true);
    try {
      if (flowMode === 'leave_backpack' && leaveBackpackBook) {
        if (!isbnMatches(isbn, leaveBackpackBook.isbn)) {
          setError('ISBN non corrisponde al libro nel tuo zaino. Inquadra il volume giusto.');
          setScanHint('');
          return;
        }
        setBook({
          id: leaveBackpackBook.id,
          isbn: leaveBackpackBook.isbn,
          title: leaveBackpackBook.title,
          author: leaveBackpackBook.author,
        });
        setPhase('actions');
        setScanHint('');
        return;
      }

      const { book: b, provider } = await loadBook(isbn);
      setBook(b);
      setBookProvider(provider ?? 'db');
      setPhase('book_preview');
      if (flowMode === 'leave_here' && point) {
        await checkAvailability(point.id, b.isbn);
      } else if (flowMode === 'full') {
        if (point) {
          await checkAvailability(point.id, b.isbn);
        } else {
          void autoDetectPoint(b);
        }
      }
      setScanHint('');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const body = err.response?.data as { error?: string };
        if (err.response?.status === 404) {
          setError(body?.error ?? 'Libro non riconosciuto. Controlla l\'ISBN o riprova.');
        } else {
          setError('Impossibile recuperare i dati del libro. Verifica che il server sia avviato.');
        }
      } else {
        setError('Impossibile recuperare i dati del libro.');
      }
      setScanHint('');
    } finally {
      setLoading(false);
      processingIsbnRef.current = false;
    }
  }, [flowMode, point, leaveBackpackBook, autoDetectPoint, checkAvailability]);

  const selectPoint = useCallback(
    async (pinfo: PointInfo, source?: MapPoint) => {
      if (!userPos) {
        setError('Senza GPS attivo puoi solo inquadrare il cartello Libery (QR).');
        return;
      }

      if (flowMode === 'leave_backpack') {
        const mp = source ?? allPoints.find((p) => p.id === pinfo.id);
        if (!mp || mp.latitude == null || mp.longitude == null) {
          setError('Coordinate del punto non disponibili. Usa il cartello QR o un punto vicino.');
          return;
        }
        const km = haversineKm(userPos.lat, userPos.lng, mp.latitude, mp.longitude);
        if (km > NEAR_POINT_KM) {
          setError(
            `Devi essere nel punto (entro ${nearPointRadiusLabel()}). Sei a ${formatDistanceKm(km)}.`,
          );
          return;
        }
        setNearKm(km);
        setPoint(pinfo);
        setPointPickMode('idle');
        setError('');
        setPhase('scan_isbn');
        return;
      }

      if (!book) return;
      setPoint(pinfo);
      setPointPickMode('idle');
      setError('');
      setLoading(true);
      try {
        await checkAvailability(pinfo.id, book.isbn);
        setPhase('actions');
      } catch {
        setError('Impossibile verificare la disponibilitÃ ');
      } finally {
        setLoading(false);
      }
    },
    [book, flowMode, userPos, allPoints],
  );

  const applyPointFromQr = useCallback(
    async (token: string) => {
      const { data } = await api.get<{ point: PointInfo }>(`/points/qr/${token}`);
      const pinfo = data.point;
      const mp = allPoints.find((p) => p.id === pinfo.id);

      if (flowMode === 'leave_backpack') {
        setPoint(pinfo);
        setPointPickMode('idle');
        setError('');
        setPhase('scan_isbn');
        return;
      }

      setPoint(pinfo);
      setPointPickMode('idle');
      setError('');

      if (book) {
        if (!userPos) {
          await checkAvailability(pinfo.id, book.isbn);
          setPhase('actions');
          return;
        }
        await selectPoint(pinfo, mp);
        return;
      }

      setPhase('scan_isbn');
      setScanHint('Inquadra il codice a barre del libro da lasciare');
    },
    [allPoints, book, flowMode, selectPoint, userPos],
  );

  const handleScan = useCallback(
    async (text: string) => {
      const classified = classifyScan(text);
      if (!classified) {
        if (phase === 'scan_detect') {
          setError('Inquadra il codice a barre del libro o il cartello Libery (QR).');
        } else if (phase === 'scan_isbn') {
          setError(`Codice non riconosciuto. Prova a centrare le barre nell'area ISBN.`);
        } else if (phase === 'scan_point_qr' || pointPickMode === 'scan_qr') {
          setError('Inquadra il cartello Libery con il QR');
        }
        return;
      }
      setError('');

      if (phase === 'confirm_near' && classified.kind === 'qr' && point) {
        setLoading(true);
        try {
          const { data } = await api.get<{ point: PointInfo }>(`/points/qr/${classified.value}`);
          if (data.point.id !== point.id) {
            setError('Questo cartello non corrisponde a questo punto.');
            return;
          }
          setPhase('scan_isbn');
          setPointPickMode('idle');
          setError('');
        } catch {
          setError('Cartello non riconosciuto');
        } finally {
          setLoading(false);
        }
        return;
      }

      if (phase === 'scan_detect') {
        if (classified.kind === 'isbn') {
          await applyBookIsbn(classified.value);
          return;
        }
        if (classified.kind === 'qr') {
          if (loadingRef.current) return;
          setLoading(true);
          try {
            await applyPointFromQr(classified.value);
          } catch {
            setError('Cartello non riconosciuto');
          } finally {
            setLoading(false);
          }
        }
        return;
      }

      if (phase === 'scan_isbn') {
        if (classified.kind !== 'isbn') {
          setError("Inquadra il codice a barre dell'ISBN sul libro.");
          return;
        }
        await applyBookIsbn(classified.value);
        return;
      }

      if (phase === 'scan_point_qr' && classified.kind === 'qr') {
        if (loadingRef.current) return;
        setLoading(true);
        try {
          await applyPointFromQr(classified.value);
        } catch {
          setError('Cartello non riconosciuto');
        } finally {
          setLoading(false);
        }
      }
    },
    [phase, pointPickMode, applyPointFromQr, applyBookIsbn],
  );

  const submitManualIsbn = () => {
    const classified = classifyScan(manualIsbn.trim());
    if (!classified || classified.kind !== 'isbn') {
      setError('Inserisci un ISBN valido (10 o 13 cifre)');
      return;
    }
    void applyBookIsbn(classified.value);
  };

  const executeLeave = async () => {
    if (!point || !book) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post<{ message: string }>('/transactions/leave', {
        pointId: point.id,
        isbn: book.isbn,
      });
      setMessage(data.message);
      setPhase('done');
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error ?? 'Operazione non riuscita'
        : 'Errore di rete';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const executeTake = async () => {
    if (!point || !book) return;
    if (availability && !availability.available) {
      setError('Questo libro non Ã¨ disponibile in questo punto');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post<{ message: string }>('/transactions/take', {
        pointId: point.id,
        isbn: book.isbn,
      });
      setMessage(data.message);
      setPhase('done');
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error ?? 'Operazione non riuscita'
        : 'Errore di rete';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleTake = () => {
    if (availability && !availability.available) {
      setError('Non puoi prenderlo qui â€” il libro non risulta in questo punto.');
      return;
    }
    void executeTake();
  };

  const changeBook = () => {
    setBook(null);
    setPoint(null);
    setAvailability(null);
    setPointPickMode('idle');
    setPhase('scan_detect');
    setError('');
  };

  const changePoint = () => {
    setPoint(null);
    setAvailability(null);
    setPointPickMode('idle');
    setPhase('scan_point_qr');
    setError('');
  };

  useEffect(() => {
    if (!open || !import.meta.env.DEV) return;
    const needsQr =
      !userPos || gpsDenied || (nearKm != null && nearKm > NEAR_POINT_KM);
    const mode =
      phase === 'scan_isbn'
        ? 'isbn'
        : phase === 'scan_point_qr' || (phase === 'confirm_near' && needsQr)
          ? 'qr'
          : 'auto';
    const scannerOn =
      phase === 'scan_detect' ||
      phase === 'scan_isbn' ||
      phase === 'scan_point_qr' ||
      (phase === 'confirm_near' && needsQr);
    console.info(
      `[CameraFlow] fase=${phase} | camera=${scannerOn ? 'on' : 'off'} | lettura=${mode}`,
    );
  }, [open, phase, flowMode, userPos, gpsDenied, nearKm]);

  if (!open) return null;

  const leaveHere = flowMode === 'leave_here';
  const leaveBackpack = flowMode === 'leave_backpack';
  const isLeaveOnly = leaveHere || leaveBackpack;
  const currentStep = stepIndex(phase === 'done' ? 'actions' : phase, flowMode);
  const gpsAtPoint = nearKm != null && nearKm <= NEAR_POINT_KM;
  const needsQrOnly =
    !userPos || gpsDenied || (nearKm != null && nearKm > NEAR_POINT_KM);
  const showCompactScanner =
    phase === 'scan_detect' ||
    phase === 'scan_isbn' ||
    phase === 'scan_point_qr' ||
    (phase === 'confirm_near' && needsQrOnly);
  const scanMode =
    phase === 'scan_isbn'
      ? 'isbn'
      : phase === 'scan_point_qr' || (phase === 'confirm_near' && needsQrOnly)
        ? 'qr'
        : 'auto';
  const stepLabels = leaveBackpack
    ? [
        { key: 'scan_point_qr' as const, label: 'Punto' },
        { key: 'scan_isbn' as const, label: 'ISBN' },
        { key: 'actions' as const, label: 'Conferma' },
      ]
    : leaveHere
      ? [
          { key: 'confirm_near' as const, label: 'Qui' },
          { key: 'scan_isbn' as const, label: 'Libro' },
          { key: 'actions' as const, label: 'Conferma' },
        ]
      : STEPS;
  const flowTitle = leaveBackpack
    ? 'Lascia dal zaino'
    : leaveHere
      ? 'Lascio un libro'
      : 'Inquadra';

  return (
    <div className="camera-flow camera-flow--app">
      <header className="camera-flow-app-header">
        <button type="button" className="btn-close" onClick={handleClose} aria-label="Chiudi" />
        <span className="camera-flow-app-title">{flowTitle}</span>
      </header>

      <nav className="camera-flow-steps" aria-label="Passaggi">
        {stepLabels.map((s, i) => (
          <span
            key={s.key}
            className={`camera-flow-step ${i < currentStep ? 'done' : ''} ${i === currentStep ? 'active' : ''}`}
          >
            <span className="camera-flow-step-num">{i + 1}</span>
            {s.label}
          </span>
        ))}
      </nav>

      {showCompactScanner && (
        <div
          className={`camera-flow-scanner-wrap ${
            scanMode === 'isbn' || scanMode === 'qr' || phase === 'scan_detect'
              ? 'camera-flow-scanner-wrap--isbn'
              : ''
          }`}
        >
          <BarcodeScanner active={showCompactScanner} mode={scanMode} onScan={handleScan} onError={setError} />
          <p className="camera-flow-hint">
            {scanHint ||
              (phase === 'scan_detect'
                ? 'Inquadra'
                : scanMode === 'isbn'
                  ? "Inquadra il codice a barre dell'ISBN"
                  : 'Inquadra il cartello Libery')}
          </p>
        </div>
      )}

      <div className="camera-flow-body">
        {loading && <p className="camera-flow-status">Elaborazione…</p>}
        {error && <p className="camera-flow-error">{error}</p>}

        {phase === 'confirm_near' && point && !showCompactScanner && (
          <section className="camera-flow-card camera-flow-confirm-near">
            <h3 className="camera-flow-section-title">Sei alla {point.name}?</h3>
            {gpsAtPoint && (
              <p className="camera-flow-section-lead mb-3">
                Ti rileviamo nel punto ({formatDistanceKm(nearKm!)}).
              </p>
            )}
            <div className="d-flex flex-column gap-2">
              {gpsAtPoint && (
              <button type="button" className="btn btn-libery w-100" onClick={() => setPhase('scan_isbn')}>
                SÃ¬, lascio un libro
              </button>
              )}
              <button
                type="button"
                className="btn btn-libery-soft w-100"
                onClick={() => {
                  setFlowMode('full');
                  setPoint(null);
                  setNearKm(null);
                  setPhase('scan_detect');
                }}
              >
                No, sono in un altro punto
              </button>
            </div>
          </section>
        )}

        {phase === 'confirm_near' && point && showCompactScanner && needsQrOnly && (
          <section className="camera-flow-card mb-2">
            <p className="small text-muted mb-0">
              GPS non attivo o sei lontano: <strong>inquadrare il cartello Libery</strong> Ã¨ l&apos;unico
              modo per lasciare un libro qui.
            </p>
          </section>
        )}

        {phase === 'scan_isbn' && (
          <section className="camera-flow-manual-isbn">
            <label className="camera-flow-manual-label" htmlFor="manual-isbn">
              Oppure digita l&apos;ISBN
            </label>
            <div className="camera-flow-manual-row">
              <input
                id="manual-isbn"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                className="camera-flow-manual-input"
                placeholder="9788806211778"
                value={manualIsbn}
                onChange={(e) => setManualIsbn(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitManualIsbn();
                }}
                disabled={loading}
              />
              <button
                type="button"
                className="btn btn-libery btn-sm"
                onClick={submitManualIsbn}
                disabled={loading || !manualIsbn.trim()}
              >
                OK
              </button>
            </div>
          </section>
        )}

        {phase === 'book_preview' && book && (
          <>
            <CameraBookPreview
              book={book}
              provider={bookProvider}
              pointName={point?.name}
              availabilityMessage={availability?.message ?? null}
              availabilityOk={availability?.available}
            />
            <div className="camera-flow-actions mt-3">
              {point ? (
                <button type="button" className="btn btn-libery w-100" onClick={() => setPhase('actions')}>
                  Cosa vuoi fare?
                </button>
              ) : (
                <>
                  <p className="small text-muted mb-2">
                    Per prendere o lasciare serve un punto Libery: GPS entro {nearPointRadiusLabel()} o
                    cartello QR.
                  </p>
                  <button
                    type="button"
                    className="btn btn-libery w-100"
                    onClick={() => setPhase('scan_point_qr')}
                  >
                    Inquadra cartello Libery
                  </button>
                  {userPos && nearbyPoints.length > 0 && (
                    <ul className="list-unstyled mb-0 camera-flow-point-list mt-2">
                      {nearbyPoints.map(({ point: p, km }) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            className="camera-flow-point-btn"
                            disabled={loading}
                            onClick={() => void selectPoint(toPointInfo(p), p)}
                          >
                            <span className="camera-flow-point-name">{p.name}</span>
                            <span className="camera-flow-point-dist">{formatDistanceKm(km)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
              <button type="button" className="btn btn-libery-soft w-100 mt-2" onClick={changeBook}>
                Altro libro
              </button>
            </div>
          </>
        )}

        {phase === 'scan_point_qr' && (
          <p className="small text-muted mb-2">
            Inquadra il <strong>cartello Libery</strong> nel punto.
            {book ? ' Poi scegli se prendi o lasci.' : ' Poi inquadra il libro da lasciare.'}
          </p>
        )}

        {phase === 'scan_isbn' && point && !book && (
          <p className="small text-muted mb-2">
            Punto <strong>{point.name}</strong> riconosciuto. Inquadra il codice a barre per{' '}
            <strong>lasciare</strong> il libro.
          </p>
        )}

        {phase === 'scan_point_qr' && leaveBackpack && (
          <section className="camera-flow-section">
            <h3 className="camera-flow-section-title">Dove lasci il libro?</h3>
            <p className="camera-flow-section-lead">
              Inquadra il cartello o scegli un punto vicino (GPS entro {nearPointRadiusLabel()}).
            </p>

            {userPos && nearbyPoints.length > 0 && (
              <div className="camera-flow-nearby mb-3">
                <p className="small fw-semibold text-muted mb-2">Vicino a te</p>
                <ul className="list-unstyled mb-0 camera-flow-point-list">
                  {nearbyPoints.map(({ point: p, km }) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="camera-flow-point-btn"
                        disabled={loading}
                        onClick={() => void selectPoint(toPointInfo(p), p)}
                      >
                        <span className="camera-flow-point-name">{p.name}</span>
                        {formatPointLine(toPointInfo(p)) && (
                          <span className="camera-flow-point-meta">{formatPointLine(toPointInfo(p))}</span>
                        )}
                        <span className="camera-flow-point-dist">{formatDistanceKm(km)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!userPos && (
              <p className="small text-muted mb-3">
                Inquadra il cartello Libery nel punto.
              </p>
            )}

            {userPos && nearbyPoints.length === 0 && (
              <p className="small text-muted mb-3">
                Nessun punto Libery entro {nearPointRadiusLabel()} — avvicinati o usa il cartello QR.
              </p>
            )}
          </section>
        )}

        {phase === 'actions' && book && point && (
          <>
            <section className="camera-flow-card camera-flow-card--point">
              <div className="d-flex justify-content-between align-items-start gap-2">
                <div>
                  <span className="badge text-bg-light mb-2">
                    {POINT_TYPE_LABELS[point.type as PointType] ?? point.type}
                  </span>
                  <h3 className="h6 fw-bold mb-1">{point.name}</h3>
                  {formatPointLine(point) && (
                    <p className="small text-muted mb-0">{formatPointLine(point)}</p>
                  )}
                </div>
                {!isLeaveOnly && (
                  <button type="button" className="btn btn-sm btn-libery-soft" onClick={changePoint}>
                    Cambia
                  </button>
                )}
              </div>
            </section>

            {!isLeaveOnly && availability && (
              <p
                className={`camera-flow-availability ${availability.available ? 'is-ok' : 'is-warn'}`}
              >
                {availability.message}
              </p>
            )}

            <div className="camera-flow-actions">
              {isLeaveOnly ? (
                <>
                  <p className="camera-flow-section-title mb-2">Confermi il deposito?</p>
                  {leaveBackpack && nearKm != null && (
                    <p className="small text-muted mb-2">
                      Posizione verificata ({formatDistanceKm(nearKm)}).
                    </p>
                  )}
                  <button
                    type="button"
                    className="btn btn-libery w-100"
                    disabled={loading}
                    onClick={() => void executeLeave()}
                  >
                    Lascio il libro qui
                  </button>
                </>
              ) : (
                <>
                  <p className="camera-flow-section-title mb-2">Cosa vuoi fare?</p>
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-libery flex-fill"
                      disabled={loading || (availability !== null && !availability.available)}
                      onClick={handleTake}
                      title={
                        availability && !availability.available
                          ? 'Libro non disponibile qui'
                          : undefined
                      }
                    >
                      Prendo
                    </button>
                    <button
                      type="button"
                      className="btn btn-libery flex-fill"
                      disabled={loading}
                      onClick={() => void executeLeave()}
                    >
                      Lascio
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {phase === 'done' && (
          <section className="camera-flow-card camera-flow-card--done">
            <p className="mb-3">{message}</p>
            <button type="button" className="btn btn-libery w-100" onClick={handleClose}>
              Fatto
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
