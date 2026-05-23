import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { api } from '@/lib/api';
import { classifyScan } from '@/lib/scanUtils';
import { parseUserQrPayload } from '@/lib/userQr';
import BarcodeScanner from '@/components/BarcodeScanner';
import CameraFlowScanFeedback from '@/components/CameraFlowScanFeedback';
import { resolveBookByIsbn } from '@/lib/bookByIsbn';
import { cameraAlerts } from '@/lib/cameraAlerts';
import CameraBookPreview from '@/components/CameraBookPreview';
import UserLeaveQrSheet from '@/components/UserLeaveQrSheet';
import CameraFlowInfoMenu from '@/components/CameraFlowInfoMenu';
import BookCoverThumb from '@/components/BookCoverThumb';
import { CAMERA_GUIDE_LINES } from '@/lib/pointHelp';
import { formatDistanceKm, haversineKm, NEAR_POINT_KM, nearPointRadiusLabel } from '@/lib/geo';
import PointTypeBadge from '@/components/PointTypeBadge';
import type { LeaveBackpackBook } from '@/components/AppShell';
import type { MapPoint, PointType } from '@/types/point';
import { LiberyButton, MdIcon, MdIconButton, MdTextField } from '@/lib/material/md-react';
import { toast } from '@/stores/toastStore';
import { useCameraSessionStore } from '@/stores/cameraSessionStore';
import { useAuthStore } from '@/stores/authStore';

type BookInfo = {
  id: string;
  isbn: string;
  title: string;
  author: string | null;
  year?: number | null;
  genre?: string | null;
  publisher?: string | null;
  description?: string | null;
  coverPath?: string | null;
};

type ManagerScanPreview = {
  action: 'leave' | 'pickup';
  confirmLabel: string;
  book: { id: string; isbn: string; title: string; author: string | null; coverPath: string | null };
  user: { id: string; displayName: string | null; email: string };
  checks: { canConfirm: boolean; blockReason: string | null };
  userHadActiveTake: boolean;
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
  /** Se aperto dalla scheda /punto/:id ? flusso ?lascio qui? con conferma sede */
  contextPointId?: string | null;
  /** Libro dallo zaino: scegli punto vicino (GPS/QR) e conferma ISBN */
  leaveBackpackBook?: LeaveBackpackBook | null;
};

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

export default function CameraFlow({
  open,
  onClose,
  contextPointId: _contextPointId,
  leaveBackpackBook,
}: Props) {
  const navigate = useNavigate();
  const [flowMode, setFlowMode] = useState<FlowMode>('full');
  const [nearKm, setNearKm] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('scan_detect');
  const [, setPointPickMode] = useState<PointPickMode>('idle');
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
  type LoadingPhase = 'idle' | 'reading' | 'fetching';
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>('idle');
  const loading = loadingPhase !== 'idle';
  const [scanHint, setScanHint] = useState('');
  const [bookProvider, setBookProvider] = useState<'google' | 'openlibrary' | 'wikidata' | 'db' | null>(
    null,
  );
  const [manualIsbn, setManualIsbn] = useState('');
  const [leaveQrOpen, setLeaveQrOpen] = useState(false);
  const [cornerDonatePick, setCornerDonatePick] = useState(false);
  const [message, setMessage] = useState('');
  const [managerPreview, setManagerPreview] = useState<ManagerScanPreview | null>(null);
  const [managerConfirmBusy, setManagerConfirmBusy] = useState(false);
  // Step ISBN: dopo il QR pickup, il responsabile deve anche scansionare il libro fisico
  const [managerIsbnStep, setManagerIsbnStep] = useState(false);
  const [managerIsbnOk, setManagerIsbnOk] = useState(false);
  const loadingRef = useRef(false);
  const processingIsbnRef = useRef(false);
  const restoredSessionRef = useRef(false);
  const saveSnapshot = useCameraSessionStore((s) => s.saveSnapshot);
  const consumeSnapshot = useCameraSessionStore((s) => s.consumeSnapshot);
  const myRole = useAuthStore((s) => s.user?.role);
  const isOperator = myRole === 'point_manager' || myRole === 'point_staff' || myRole === 'admin';

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    if (!open) {
      restoredSessionRef.current = false;
      return;
    }
    const snap = consumeSnapshot();
    if (!snap) return;
    restoredSessionRef.current = true;
    setFlowMode(snap.flowMode as FlowMode);
    setPhase(snap.phase as Phase);
    setBook(snap.book);
    setPoint(snap.point);
    setBookProvider((snap.bookProvider as typeof bookProvider) ?? null);
    setScanHint('');
  }, [open, consumeSnapshot]);

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
    setScanHint('');
    setBookProvider(null);
    setManualIsbn('');
    setLeaveQrOpen(false);
    setCornerDonatePick(false);
    setManagerPreview(null);
    setManagerConfirmBusy(false);
    setManagerIsbnStep(false);
    setManagerIsbnOk(false);
    setLoadingPhase('idle');
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

    // La fotocamera ? sempre uguale indipendentemente da dove viene aperta.
    // contextPointId viene ignorato: il flusso ? sempre scan_detect standard.
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
  }, [open, leaveBackpackBook]);

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

  const nearbyCorners = useMemo(
    () => nearbyPoints.filter(({ point: p }) => p.type === 'corner_free'),
    [nearbyPoints],
  );

  const pickingCornerForDonate = cornerDonatePick && Boolean(book) && !leaveBackpackBook;

  const applyBookIsbn = useCallback(async (isbn: string) => {
    if (processingIsbnRef.current) return;
    processingIsbnRef.current = true;
    setScanHint(CAMERA_GUIDE_LINES.findBook);
    setBook(null);
    setBookProvider(null);
    setLoadingPhase('fetching');
    try {
      if (flowMode === 'leave_backpack' && leaveBackpackBook) {
        if (!isbnMatches(isbn, leaveBackpackBook.isbn)) {
          cameraAlerts.isbnNotRecognized();
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

      const { book: b, provider } = await resolveBookByIsbn(isbn);
      setBook(b);
      setBookProvider(provider === 'cache' || provider === 'db' ? 'db' : provider);
      if (flowMode === 'leave_here' && point?.type === 'corner_free') {
        await checkAvailability(point.id, b.isbn);
        setPhase('actions');
        setScanHint('');
        return;
      }

      setPhase('book_preview');
      if (flowMode === 'leave_here' && point && point.type !== 'corner_free') {
        await checkAvailability(point.id, b.isbn);
      }
      setScanHint('');
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        cameraAlerts.bookNotFound();
      } else {
        cameraAlerts.bookNotRecognized();
      }
      setScanHint('');
    } finally {
      setLoadingPhase('idle');
      processingIsbnRef.current = false;
    }
  }, [flowMode, point, leaveBackpackBook, checkAvailability]);

  /** Codice ISBN letto: ferma decode, mostra ?Sto leggendo?, poi recupero. */
  const beginIsbnLookup = useCallback(
    (isbn: string) => {
      setLoadingPhase('reading');
      void applyBookIsbn(isbn);
    },
    [applyBookIsbn],
  );

  const selectPoint = useCallback(
    async (pinfo: PointInfo, source?: MapPoint) => {
      if (!userPos) {
        toast.warning('Senza GPS attivo puoi solo inquadrare il cartello Libery (QR).');
        return;
      }

      if (flowMode === 'leave_backpack') {
        const mp = source ?? allPoints.find((p) => p.id === pinfo.id);
        if (!mp || mp.latitude == null || mp.longitude == null) {
          toast.warning('Senza GPS attivo puoi solo inquadrare il cartello Libery (QR).');
          return;
        }
        const km = haversineKm(userPos.lat, userPos.lng, mp.latitude, mp.longitude);
        if (km > NEAR_POINT_KM) {
          toast.warning(
            `Sei a ${formatDistanceKm(km)}: avvicinati (entro ${nearPointRadiusLabel()}) o usa il cartello QR.`,
            { duration: 6000 },
          );
          return;
        }
        setNearKm(km);
        setPoint(pinfo);
        setPointPickMode('idle');
        setPhase('scan_isbn');
        return;
      }

      if (!book) return;
      if (flowMode === 'full' && pinfo.type !== 'corner_free') {
        toast.warning('Per donare scegli un Corner Free vicino a te.');
        return;
      }
      setPoint(pinfo);
      setPointPickMode('idle');
      if (flowMode === 'full' && pinfo.type === 'corner_free') {
        setPhase('actions');
        return;
      }
      setLoadingPhase('fetching');
      try {
        await checkAvailability(pinfo.id, book.isbn);
        setPhase('actions');
      } catch {
        cameraAlerts.bookNotRecognized();
      } finally {
        setLoadingPhase('idle');
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
        setPhase('scan_isbn');
        return;
      }

      setPoint(pinfo);
      setPointPickMode('idle');

      if (book) {
        if (pinfo.type === 'corner_free' && flowMode === 'full') {
          setNearKm(
            userPos && mp?.latitude != null && mp.longitude != null
              ? haversineKm(userPos.lat, userPos.lng, mp.latitude, mp.longitude)
              : null,
          );
          setPhase('actions');
          return;
        }
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

  const handleManagerQrScan = useCallback(async (qrText: string) => {
    setLoadingPhase('fetching');
    setManagerIsbnOk(false);
    try {
      const { data } = await api.post<{ preview: ManagerScanPreview }>('/manager/scan', { qr: qrText });
      setManagerPreview(data.preview);
      // Per i ritiri (pickup) richiediamo anche la scansione fisica del libro
      if (data.preview.action === 'pickup') {
        setManagerIsbnStep(true);
      }
    } catch {
      cameraAlerts.bookNotRecognized();
    } finally {
      setLoadingPhase('idle');
    }
  }, []);

  const handleManagerConfirm = useCallback(async () => {
    if (!managerPreview) return;
    setManagerConfirmBusy(true);
    try {
      const { data } = await api.post<{ ok: boolean; message: string }>('/manager/scan/confirm', {
        action: managerPreview.action,
        isbn: managerPreview.book.isbn,
        userId: managerPreview.user.id,
      });
      toast.success(data.message);
      // Chiudi la camera dopo la conferma
      onClose();
    } catch {
      cameraAlerts.bookNotRecognized();
    } finally {
      setManagerConfirmBusy(false);
    }
  }, [managerPreview, onClose]);

  const handleScan = useCallback(
    async (text: string) => {
      // Step ISBN per ritiro: il responsabile deve scansionare il libro fisico
      if (managerIsbnStep && managerPreview) {
        const classified = classifyScan(text);
        if (classified?.kind === 'isbn') {
          if (isbnMatches(classified.value, managerPreview.book.isbn)) {
            setManagerIsbnStep(false);
            setManagerIsbnOk(true);
          } else {
            cameraAlerts.isbnNotRecognized();
          }
        } else {
          cameraAlerts.isbnNotRecognized();
        }
        return;
      }

      // Se operatore (manager/staff), intercetta i QR utente formato L,ISBN,uuid o P,ISBN,uuid
      if (isOperator && !managerPreview) {
        const userQr = parseUserQrPayload(text);
        if (userQr) {
          await handleManagerQrScan(text);
          return;
        }
      }

      const classified = classifyScan(text);
      if (!classified) {
        setLoadingPhase('idle');
        cameraAlerts.isbnNotRecognized();
        return;
      }
      if (phase === 'confirm_near' && classified.kind === 'qr' && point) {
        setLoadingPhase('fetching');
        try {
          const { data } = await api.get<{ point: PointInfo }>(`/points/qr/${classified.value}`);
          if (data.point.id !== point.id) {
            cameraAlerts.bookNotRecognized();
            return;
          }
          setPhase('scan_isbn');
          setPointPickMode('idle');
        } catch {
          cameraAlerts.bookNotRecognized();
        } finally {
          setLoadingPhase('idle');
        }
        return;
      }

      if (phase === 'scan_detect') {
        if (classified.kind === 'isbn') {
          beginIsbnLookup(classified.value);
          return;
        }
        if (classified.kind === 'qr') {
          if (loadingRef.current) return;
          setLoadingPhase('fetching');
          try {
            if (flowMode === 'full' && !book) {
              await goToPointPage(classified.value);
              return;
            }
            await applyPointFromQr(classified.value);
          } catch {
            cameraAlerts.bookNotRecognized();
          } finally {
            setLoadingPhase('idle');
          }
        }
        return;
      }

      if (phase === 'scan_isbn') {
        if (classified.kind !== 'isbn') {
          cameraAlerts.isbnNotRecognized();
          return;
        }
        beginIsbnLookup(classified.value);
        return;
      }

      if (phase === 'scan_point_qr' && classified.kind === 'qr') {
        if (loadingRef.current) return;
        setLoadingPhase('fetching');
        try {
          await applyPointFromQr(classified.value);
        } catch {
          cameraAlerts.bookNotRecognized();
        } finally {
          setLoadingPhase('idle');
        }
      }
    },
    [phase, point, book, flowMode, applyPointFromQr, beginIsbnLookup, isOperator, managerPreview, handleManagerQrScan, managerIsbnStep, goToPointPage, loading],
  );

  const submitManualIsbn = () => {
    const classified = classifyScan(manualIsbn.trim());
    if (!classified || classified.kind !== 'isbn') {
      cameraAlerts.isbnNotRecognized();
      return;
    }
    beginIsbnLookup(classified.value);
  };

  const executeLeave = async () => {
    if (!point || !book) return;
    setLoadingPhase('fetching');
    try {
      const { data } = await api.post<{ message: string }>('/transactions/leave', {
        pointId: point.id,
        isbn: book.isbn,
      });
      setMessage(data.message);
      setPhase('done');
    } catch {
      cameraAlerts.bookNotRecognized();
    } finally {
      setLoadingPhase('idle');
    }
  };

  const persistPreviewSnapshot = useCallback(() => {
    if (!book) return;
    saveSnapshot({
      phase: 'book_preview',
      flowMode,
      book,
      point,
      bookProvider,
    });
  }, [book, flowMode, point, bookProvider, saveSnapshot]);

  const openBookFromPreview = useCallback(() => {
    if (!book) return;
    persistPreviewSnapshot();
    onClose();
    navigate(`/libro/${book.id}`, { state: { fromCamera: true } });
  }, [book, persistPreviewSnapshot, onClose, navigate]);

  const startCornerDonatePick = useCallback(() => {
    setLeaveQrOpen(false);
    setCornerDonatePick(true);
    setPhase('scan_point_qr');
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
    } else {
      setGpsDenied(true);
    }
  }, [loadPointsCatalog]);

  function handleDonaClick() {
    if (!book) return;
    if (point?.type === 'corner_free') {
      void executeLeave();
      return;
    }
    setLeaveQrOpen(true);
  }

  async function goToPointPage(token: string) {
    const { data } = await api.get<{ point: PointInfo }>(`/points/qr/${token}`);
    navigate(`/punto/${data.point.id}`);
    reset();
    onClose();
  }

  const changeBook = () => {
    setBook(null);
    setPoint(null);
    setAvailability(null);
    setPointPickMode('idle');
    setCornerDonatePick(false);
    setLeaveQrOpen(false);
    setPhase('scan_detect');
  };

  const changePoint = () => {
    setPoint(null);
    setAvailability(null);
    setPointPickMode('idle');
    setPhase('scan_point_qr');
  };

  const handleCameraError = useCallback((msg: string) => {
    toast.warning(msg);
  }, []);

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

  const gpsSnackbarKeyRef = useRef('');
  useEffect(() => {
    if (!open || phase !== 'confirm_near' || !point) return;
    const needsQr =
      !userPos || gpsDenied || (nearKm != null && nearKm > NEAR_POINT_KM);
    if (!needsQr) {
      gpsSnackbarKeyRef.current = '';
      return;
    }
    const key = `${point.id}-${phase}`;
    if (gpsSnackbarKeyRef.current === key) return;
    gpsSnackbarKeyRef.current = key;
    toast.warning(
      'GPS non attivo o sei lontano: inquadra il cartello Libery per lasciare il libro qui.',
      { duration: 6000 },
    );
  }, [open, phase, point, userPos, gpsDenied, nearKm]);

  if (!open) return null;

  const leaveHere = flowMode === 'leave_here';
  const leaveBackpack = flowMode === 'leave_backpack';
  const isLeaveOnly = leaveHere || leaveBackpack;
  const gpsAtPoint = nearKm != null && nearKm <= NEAR_POINT_KM;
  const needsQrOnly =
    !userPos || gpsDenied || (nearKm != null && nearKm > NEAR_POINT_KM);
  const showCompactScanner =
    // Scanner ISBN attivo durante lo step di verifica libro fisico (pickup)
    managerIsbnStep ||
    (!managerPreview &&
      (phase === 'scan_detect' ||
        phase === 'scan_isbn' ||
        phase === 'book_preview' ||
        phase === 'scan_point_qr' ||
        (phase === 'confirm_near' && needsQrOnly)));
  const scanMode =
    managerIsbnStep
      ? 'isbn'
      : phase === 'scan_isbn' || phase === 'book_preview'
        ? 'isbn'
        : phase === 'scan_point_qr' || (phase === 'confirm_near' && needsQrOnly)
          ? 'qr'
          : 'auto';
  const flowTitle = leaveBackpack
    ? 'Lascia dal zaino'
    : leaveHere && point
      ? point.type === 'corner_free'
        ? 'Dona nel corner'
        : 'Dona al punto'
      : 'Fotocamera Libery';

  return (
    <div className="camera-flow camera-flow--app camera-flow--material">
      <header className="camera-flow-app-header libery-material-surface">
        <MdIconButton type="button" color="standard" aria-label="Chiudi" onClick={handleClose}>
          <MdIcon>close</MdIcon>
        </MdIconButton>
        <span className="camera-flow-app-title">{flowTitle}</span>
        <div className="camera-flow-app-header__spacer" aria-hidden />
        <CameraFlowInfoMenu
          pointType={point?.type}
          variant={leaveHere || leaveBackpack ? 'leave' : 'default'}
          phaseHint={
            showCompactScanner
              ? phase === 'scan_detect'
                ? 'Inquadra il codice a barre del libro o il cartello Libery (QR).'
                : scanMode === 'isbn'
                  ? "Inquadra il codice a barre dell'ISBN sul dorso del libro."
                  : 'Inquadra il cartello Libery con il QR.'
              : null
          }
          scanHint={scanHint || null}
        />
      </header>

      {showCompactScanner && (
        <div
          className={`camera-flow-scanner-wrap ${
            scanMode === 'isbn' || scanMode === 'qr' || phase === 'scan_detect'
              ? 'camera-flow-scanner-wrap--isbn'
              : ''
          }`}
        >
          <BarcodeScanner
            active={showCompactScanner}
            paused={loadingPhase !== 'idle'}
            mode={scanMode}
            showScanOverlay={false}
            onScan={handleScan}
            onError={handleCameraError}
          />
        </div>
      )}

      <CameraFlowScanFeedback loadingPhase={loadingPhase} />

      <div className="camera-flow-body">
        {managerPreview && !loading && (
          <section className="camera-flow-card manager-scan-preview">
            <div className="d-flex gap-3 align-items-start mb-3">
              <BookCoverThumb
                title={managerPreview.book.title}
                isbn={managerPreview.book.isbn}
                coverPath={managerPreview.book.coverPath}
                coverSize="list"
              />
              <div className="min-w-0">
                <p className="camera-flow-book-title mb-1">{managerPreview.book.title}</p>
                {managerPreview.book.author ? (
                  <p className="camera-flow-book-author mb-1">{managerPreview.book.author}</p>
                ) : null}
                <p className="small text-muted mb-0">
                  {managerPreview.action === 'leave' ? 'Donazione' : 'Ritiro'} ?{' '}
                  {managerPreview.user.displayName?.trim() || managerPreview.user.email.split('@')[0]}
                </p>
              </div>
            </div>

            {/* Step ISBN per ritiro: scansiona il libro fisico per confermare */}
            {managerPreview.action === 'pickup' && !managerIsbnOk && (
              <div className="manager-isbn-step">
                <p className="manager-isbn-step__label">
                  <MdIcon>barcode_scanner</MdIcon>
                  Inquadra il codice a barre del libro da consegnare
                </p>
              </div>
            )}

            {managerPreview.action === 'pickup' && managerIsbnOk && (
              <p className="manager-isbn-step manager-isbn-step--ok">
                <MdIcon>check_circle</MdIcon>
                Libro confermato ? ISBN verificato
              </p>
            )}

            <div className="d-flex gap-2 mt-3">
              <LiberyButton
                type="button"
                color="outlined"
                className="flex-fill"
                onClick={() => {
                  setManagerPreview(null);
                  setManagerIsbnStep(false);
                  setManagerIsbnOk(false);
                }}
              >
                Annulla
              </LiberyButton>
              <LiberyButton
                type="button"
                color="filled"
                className="flex-fill"
                disabled={
                  !managerPreview.checks.canConfirm ||
                  managerConfirmBusy ||
                  (managerPreview.action === 'pickup' && !managerIsbnOk)
                }
                onClick={() => void handleManagerConfirm()}
              >
                {managerPreview.action === 'pickup' && !managerIsbnOk
                  ? 'Scansiona libro?'
                  : managerPreview.confirmLabel}
              </LiberyButton>
            </div>
          </section>
        )}

        {phase === 'book_preview' && book && !leaveQrOpen && !cornerDonatePick ? (
          <section className="camera-flow-book-preview-section" aria-label="Libro riconosciuto">
            <CameraBookPreview book={book} onOpenBook={openBookFromPreview} />
            <div className="libery-book-sheet-actions libery-book-sheet-actions--dona">
              <LiberyButton
                type="button"
                color="outlined"
                size="small"
                className="libery-book-sheet-actions__btn"
                disabled={loading}
                onClick={handleDonaClick}
              >
                Dona
              </LiberyButton>
            </div>
          </section>
        ) : null}

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
              <LiberyButton type="button" color="filled" className="w-100" onClick={() => setPhase('scan_isbn')}>
                S?, lascio un libro qui
              </LiberyButton>
              )}
              <LiberyButton
                type="button"
                color="tonal"
                className="w-100"
                onClick={() => {
                  setFlowMode('full');
                  setPoint(null);
                  setNearKm(null);
                  setPhase('scan_detect');
                }}
              >
                No, sono in un altro punto
              </LiberyButton>
            </div>
          </section>
        )}

        {phase === 'scan_isbn' && (
          <section className="camera-flow-manual-isbn">
            <label className="camera-flow-manual-label" htmlFor="manual-isbn">
              Oppure digita l&apos;ISBN
            </label>
            <div className="camera-flow-manual-row align-items-start">
              <MdTextField
                id="manual-isbn"
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
                  if (e.key === 'Enter') submitManualIsbn();
                }}
              />
              <LiberyButton
                type="button"
                color="filled"
                size="small"
                style={{ alignSelf: 'center' }}
                onClick={submitManualIsbn}
                disabled={loading || !manualIsbn.trim()}
              >
                OK
              </LiberyButton>
            </div>
          </section>
        )}

        {phase === 'scan_point_qr' && leaveBackpack && (
          <p className="small text-muted mb-2">
            Inquadra il <strong>cartello Libery</strong> nel punto, poi il codice a barre del libro.
          </p>
        )}

        {phase === 'scan_isbn' && point && !book && (
          <p className="small text-muted mb-2">
            Punto <strong>{point.name}</strong> riconosciuto. Inquadra il codice a barre per{' '}
            <strong>lasciare</strong> il libro.
          </p>
        )}

        {(phase === 'scan_point_qr' && (leaveBackpack || pickingCornerForDonate)) && (
          <section className="camera-flow-section camera-flow-section--corner-pick">
            <h3 className="camera-flow-section-title">
              {pickingCornerForDonate ? 'Dona in un Corner Free' : 'Dove lasci il libro?'}
            </h3>
            <p className="camera-flow-section-lead">
              {pickingCornerForDonate
                ? `Inquadra il QR sul cartello del corner, oppure seleziona un corner entro ${nearPointRadiusLabel()}.`
                : `Inquadra il cartello o scegli un punto vicino (GPS entro ${nearPointRadiusLabel()}).`}
            </p>

            {userPos && (pickingCornerForDonate ? nearbyCorners : nearbyPoints).length > 0 && (
              <div className="camera-flow-nearby mb-3">
                <p className="small fw-semibold text-muted mb-2">Vicino a te</p>
                <ul className="list-unstyled mb-0 camera-flow-point-list">
                  {(pickingCornerForDonate ? nearbyCorners : nearbyPoints).map(({ point: p, km }) => (
                    <li key={p.id}>
                      <LiberyButton
                        type="button"
                        color="elevated"
                        className="camera-flow-point-btn w-100"
                        disabled={loading}
                        onClick={() => void selectPoint(toPointInfo(p), p)}
                      >
                        <span className="camera-flow-point-name">{p.name}</span>
                        {formatPointLine(toPointInfo(p)) && (
                          <span className="camera-flow-point-meta">{formatPointLine(toPointInfo(p))}</span>
                        )}
                        <span className="camera-flow-point-dist">{formatDistanceKm(km)}</span>
                      </LiberyButton>
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

            {userPos &&
              (pickingCornerForDonate ? nearbyCorners : nearbyPoints).length === 0 && (
              <p className="small text-muted mb-3">
                {pickingCornerForDonate
                  ? `Nessun Corner Free entro ${nearPointRadiusLabel()} ? avvicinati o inquadra il QR sul cartello.`
                  : `Nessun punto Libery entro ${nearPointRadiusLabel()} ? avvicinati o usa il cartello QR.`}
              </p>
            )}
          </section>
        )}

        {phase === 'actions' && book && point && (
          <>
            <section className="camera-flow-card camera-flow-card--point">
              <div className="d-flex justify-content-between align-items-start gap-2">
                <div>
                  <PointTypeBadge type={point.type as PointType} />
                  <h3 className="h6 fw-bold mb-1">{point.name}</h3>
                  {formatPointLine(point) && (
                    <p className="small text-muted mb-0">{formatPointLine(point)}</p>
                  )}
                </div>
                {!isLeaveOnly && (
                  <LiberyButton type="button" color="tonal" size="small" onClick={changePoint}>
                    Cambia
                  </LiberyButton>
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
                  <LiberyButton
                    type="button"
                    color="filled"
                    className="w-100"
                    disabled={loading}
                    onClick={() => {
                      if (point?.type === 'corner_free') void executeLeave();
                      else handleDonaClick();
                    }}
                  >
                    {point?.type === 'corner_free' ? 'Dona nel corner' : 'Genera QR per addetto'}
                  </LiberyButton>
                </>
              ) : point?.type === 'corner_free' ? (
                <>
                  <CameraBookPreview book={book} onOpenBook={openBookFromPreview} />
                  <section className="camera-flow-card camera-flow-corner-confirm mt-3">
                    <p className="camera-flow-section-title mb-1">
                      Sei al <strong>{point.name}</strong>
                    </p>
                    <p className="small text-muted mb-3">
                      Corner Free ? lascia il libro qui, nessun addetto necessario.
                    </p>
                    <LiberyButton
                      type="button"
                      color="filled"
                      className="w-100"
                      disabled={loading}
                      onClick={() => void executeLeave()}
                    >
                      Dona qui
                    </LiberyButton>
                    <LiberyButton type="button" color="text" className="w-100 mt-2" onClick={changeBook}>
                      Altro libro
                    </LiberyButton>
                  </section>
                </>
              ) : (
                <>
                  <CameraBookPreview book={book} onOpenBook={openBookFromPreview} />
                    <div className="libery-book-sheet-actions libery-book-sheet-actions--dona mt-3">
                      <LiberyButton
                        type="button"
                        color="outlined"
                        size="small"
                        className="libery-book-sheet-actions__btn"
                        disabled={loading}
                        onClick={handleDonaClick}
                      >
                        Dona
                      </LiberyButton>
                    </div>
                </>
              )}
            </div>
          </>
        )}

        {phase === 'done' && (
          <section className="camera-flow-card camera-flow-card--done">
            <p className="mb-3">{message}</p>
            <LiberyButton type="button" color="filled" className="w-100" onClick={handleClose}>
              Fatto
            </LiberyButton>
          </section>
        )}
      </div>

      {book && (
        <UserLeaveQrSheet
          open={leaveQrOpen}
          onOpenChange={setLeaveQrOpen}
          book={book}
          pointName={
            point && point.type !== 'corner_free' ? point.name : null
          }
          showCornerOption={!point || point.type !== 'corner_free'}
          onAtCorner={startCornerDonatePick}
          onVerified={() => {
            setLeaveQrOpen(false);
            setCornerDonatePick(false);
            setMessage('Libro consegnato. Grazie per averlo messo in circolo!');
            setPhase('done');
          }}
        />
      )}
    </div>
  );
}
