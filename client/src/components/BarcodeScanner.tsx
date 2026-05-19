import { useEffect, useRef } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

type Props = {
  active: boolean;
  mode: 'auto' | 'isbn' | 'qr';
  onScan: (text: string) => void;
  onError?: (msg: string) => void;
};

function createReader(mode: 'auto' | 'isbn' | 'qr') {
  const hints = new Map();
  const formats =
    mode === 'qr'
      ? [BarcodeFormat.QR_CODE]
      : mode === 'isbn'
        ? [
            BarcodeFormat.EAN_13,
            BarcodeFormat.EAN_8,
            BarcodeFormat.UPC_A,
            BarcodeFormat.UPC_E,
            BarcodeFormat.CODE_128,
          ]
        : [
            BarcodeFormat.QR_CODE,
            BarcodeFormat.EAN_13,
            BarcodeFormat.EAN_8,
            BarcodeFormat.UPC_A,
            BarcodeFormat.CODE_128,
          ];
  hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatReader(hints);
}

export default function BarcodeScanner({ active, mode, onScan, onError }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastRef = useRef('');
  const cooldownRef = useRef(false);
  const controlsRef = useRef<IScannerControls | null>(null);
  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);

  onScanRef.current = onScan;
  onErrorRef.current = onError;

  useEffect(() => {
    if (active) {
      lastRef.current = '';
      cooldownRef.current = false;
    }
  }, [active, mode]);

  useEffect(() => {
    if (!active) {
      controlsRef.current?.stop();
      controlsRef.current = null;
      return;
    }

    const reader = createReader(mode);
    let cancelled = false;

    (async () => {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const back = devices.find((d) => /back|rear|posteriore/i.test(d.label)) ?? devices[0];
        if (!videoRef.current || cancelled) return;

        controlsRef.current = await reader.decodeFromVideoDevice(
          back?.deviceId,
          videoRef.current,
          (result) => {
            if (cancelled || !result) return;
            const text = result.getText().trim();
            if (!text || text === lastRef.current || cooldownRef.current) return;
            lastRef.current = text;
            cooldownRef.current = true;
            onScanRef.current(text);
            setTimeout(() => {
              cooldownRef.current = false;
            }, 1200);
          },
        );
      } catch {
        onErrorRef.current?.('Impossibile accedere alla fotocamera. Consenti l\'accesso nelle impostazioni.');
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [active, mode]);

  return (
    <div className={`scanner-viewport scanner-viewport--${mode}`}>
      <video ref={videoRef} className="scanner-video" muted playsInline />
      <div className="scanner-overlay">
        {mode === 'isbn' ? (
          <div className="scanner-isbn-zone" aria-hidden>
            <div className="scanner-isbn-bars" />
          </div>
        ) : mode === 'qr' ? (
          <div className="scanner-qr-zone" aria-hidden>
            <div className="scanner-qr-fake" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
