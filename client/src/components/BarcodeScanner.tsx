import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { acquireCameraStream, isMobileDevice } from '@/lib/cameraStream';
import { MdIconButton } from '@/lib/material/md-react';

const SCAN_COOLDOWN_MS = 2000;

type Props = {
  active: boolean;
  /** Ferma il decode (durante API) mantenendo l'ultimo frame video. */
  paused?: boolean;
  mode: 'auto' | 'isbn' | 'qr';
  onScan: (text: string) => void;
  onError?: (msg: string) => void;
  showCaptureControls?: boolean;
  showScanOverlay?: boolean;
};

function formatsForMode(mode: 'auto' | 'isbn' | 'qr') {
  if (mode === 'qr') return [BarcodeFormat.QR_CODE];
  if (mode === 'isbn') {
    return [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.ITF,
    ];
  }
  return [
    BarcodeFormat.QR_CODE,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.CODE_128,
  ];
}

function createZxingReader(mode: 'auto' | 'isbn' | 'qr', tryHarder: boolean) {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, formatsForMode(mode));
  if (tryHarder) hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatReader(hints);
}

type TrackCaps = MediaTrackCapabilities & {
  focusMode?: string[];
  torch?: boolean;
};

async function enableContinuousFocus(stream: MediaStream) {
  const track = stream.getVideoTracks()[0];
  if (!track?.getCapabilities) return;
  try {
    const caps = track.getCapabilities() as TrackCaps;
    if (caps.focusMode?.includes('continuous')) {
      await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] });
    } else if (caps.focusMode?.includes('auto')) {
      await track.applyConstraints({ advanced: [{ focusMode: 'auto' } as MediaTrackConstraintSet] });
    }
  } catch {
    /* ignore */
  }
}

async function triggerRefocus(stream: MediaStream | null) {
  const track = stream?.getVideoTracks()[0];
  if (!track?.getCapabilities) return;
  try {
    const caps = track.getCapabilities() as TrackCaps;
    if (caps.focusMode?.includes('manual')) {
      await track.applyConstraints({ advanced: [{ focusMode: 'manual' } as MediaTrackConstraintSet] });
      await new Promise((r) => setTimeout(r, 80));
    }
    if (caps.focusMode?.includes('continuous')) {
      await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] });
    } else if (caps.focusMode?.includes('auto')) {
      await track.applyConstraints({ advanced: [{ focusMode: 'auto' } as MediaTrackConstraintSet] });
    }
  } catch {
    /* ignore */
  }
}

function waitForVideoReady(video: HTMLVideoElement, timeoutMs = 12000): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('video-timeout'));
    }, timeoutMs);
    const onReady = () => {
      if (video.videoWidth > 0) {
        cleanup();
        resolve();
      }
    };
    const cleanup = () => {
      window.clearTimeout(timer);
      video.removeEventListener('loadedmetadata', onReady);
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('playing', onReady);
    };
    video.addEventListener('loadedmetadata', onReady);
    video.addEventListener('loadeddata', onReady);
    video.addEventListener('playing', onReady);
  });
}

type NativeBarcodeDetector = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
};

function nativeFormatsForMode(mode: 'auto' | 'isbn' | 'qr'): string[] {
  if (mode === 'qr') return ['qr_code'];
  if (mode === 'isbn') {
    return ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'];
  }
  return ['qr_code', 'ean_13', 'ean_8', 'upc_a', 'code_128'];
}

function getNativeBarcodeDetector(mode: 'auto' | 'isbn' | 'qr'): NativeBarcodeDetector | null {
  const Ctor = (globalThis as { BarcodeDetector?: new (opts: { formats: string[] }) => NativeBarcodeDetector })
    .BarcodeDetector;
  if (!Ctor) return null;
  try {
    return new Ctor({ formats: nativeFormatsForMode(mode) });
  } catch {
    return null;
  }
}

export default function BarcodeScanner({
  active,
  paused = false,
  mode,
  onScan,
  onError,
  showCaptureControls = true,
  showScanOverlay = false,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastRef = useRef('');
  const cooldownRef = useRef(false);
  const controlsRef = useRef<IScannerControls | null>(null);
  const decodeLoopRef = useRef(false);
  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  onScanRef.current = onScan;
  onErrorRef.current = onError;

  const emitScan = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || trimmed === lastRef.current || cooldownRef.current) return;
    lastRef.current = trimmed;
    cooldownRef.current = true;
    onScanRef.current(trimmed);
    window.setTimeout(() => {
      cooldownRef.current = false;
    }, SCAN_COOLDOWN_MS);
  }, []);

  const stopDecoding = useCallback(() => {
    decodeLoopRef.current = false;
    controlsRef.current?.stop();
    controlsRef.current = null;
  }, []);

  useEffect(() => {
    if (active) {
      lastRef.current = '';
      cooldownRef.current = false;
      setTorchOn(false);
      setCameraReady(false);
    }
  }, [active, mode]);

  // Avvio / stop stream camera
  useEffect(() => {
    if (!active) {
      stopDecoding();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setTorchSupported(false);
      setCameraReady(false);
      const video = videoRef.current;
      if (video) video.srcObject = null;
      return;
    }

    const mobile = isMobileDevice();
    let cancelled = false;

    (async () => {
      try {
        const video = videoRef.current;
        if (!video || cancelled) return;
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('no-api');

        const stream = await acquireCameraStream(mobile);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        video.setAttribute('playsinline', 'true');
        try {
          await video.play();
        } catch {
          /* autoplay */
        }
        await waitForVideoReady(video);
        if (cancelled) return;

        setCameraReady(true);
        await enableContinuousFocus(stream);

        const track = stream.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() as TrackCaps | undefined;
        setTorchSupported(Boolean(caps?.torch));
      } catch (err) {
        if (cancelled) return;
        setCameraReady(false);
        const isDenied =
          err instanceof DOMException &&
          (err.name === 'NotAllowedError' || err.name === 'SecurityError');
        onErrorRef.current?.(
          isDenied
            ? 'Consenti l\'accesso alla fotocamera nelle impostazioni del browser.'
            : 'Fotocamera non disponibile. Chiudi altre app che la usano e riprova.',
        );
      }
    })();

    return () => {
      cancelled = true;
      stopDecoding();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const video = videoRef.current;
      if (video) video.srcObject = null;
    };
  }, [active, mode, stopDecoding]);

  // Decode: un solo motore (nativo se disponibile, altrimenti ZXing). Si ferma con paused.
  useEffect(() => {
    if (!active || !cameraReady || paused) {
      stopDecoding();
      return;
    }

    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    const mobile = isMobileDevice();
    let cancelled = false;
    decodeLoopRef.current = true;

    const runNative = (detector: NativeBarcodeDetector) => {
      const loop = async () => {
        while (decodeLoopRef.current && !cancelled) {
          try {
            if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
              const codes = await detector.detect(video);
              for (const code of codes) {
                if (code.rawValue) emitScan(code.rawValue);
              }
            }
          } catch {
            /* frame non decodificabile */
          }
          await new Promise<void>((r) => requestAnimationFrame(() => r()));
        }
      };
      void loop();
    };

    const runZxing = async () => {
      const reader = createZxingReader(mode, !mobile);
      try {
        controlsRef.current = await reader.decodeFromStream(stream, video, (result) => {
          if (cancelled || !result) return;
          emitScan(result.getText());
        });
      } catch {
        /* stream chiuso */
      }
    };

    const nativeDetector = getNativeBarcodeDetector(mode);
    if (nativeDetector) runNative(nativeDetector);
    else void runZxing();

    return () => {
      cancelled = true;
      stopDecoding();
    };
  }, [active, cameraReady, paused, mode, emitScan, stopDecoding]);

  const handleTapFocus = useCallback(() => {
    void triggerRefocus(streamRef.current);
  }, []);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track?.getCapabilities) return;
    const caps = track.getCapabilities() as TrackCaps;
    if (!caps.torch) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      /* ignore */
    }
  }, [torchOn]);

  return (
    <div className={`scanner-viewport scanner-viewport--${mode}`}>
      <video
        ref={videoRef}
        className={`scanner-video${cameraReady ? ' scanner-video--live' : ''}`}
        muted
        playsInline
        autoPlay
        onClick={showCaptureControls ? handleTapFocus : undefined}
      />
      {showScanOverlay ? (
        <div className="scanner-overlay">
          {mode === 'isbn' || mode === 'auto' ? (
            <div className="scanner-isbn-zone" aria-hidden>
              <div className="scanner-isbn-bars" />
            </div>
          ) : null}
          {mode === 'qr' ? (
            <div className="scanner-qr-zone" aria-hidden>
              <div className="scanner-qr-fake" />
            </div>
          ) : null}
        </div>
      ) : null}
      {showCaptureControls && torchSupported ? (
        <div className="scanner-capture-controls scanner-capture-controls--torch-only">
          <MdIconButton
            type="button"
            aria-label={torchOn ? 'Spegni torcia' : 'Accendi torcia'}
            onClick={() => void toggleTorch()}
            className={torchOn ? 'scanner-torch-on' : ''}
          >
            <span className="material-symbols-outlined" aria-hidden>
              {torchOn ? 'flashlight_on' : 'flashlight_off'}
            </span>
          </MdIconButton>
        </div>
      ) : null}
    </div>
  );
}
