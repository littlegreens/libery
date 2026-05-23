import CameraFlowStatus from '@/components/CameraFlowStatus';

type LoadingPhase = 'idle' | 'reading' | 'fetching';

/** Stato caricamento sotto la preview (solo testo, allineato a sinistra). */
export default function CameraFlowScanFeedback({
  loadingPhase,
}: {
  loadingPhase: LoadingPhase;
}) {
  if (loadingPhase !== 'reading' && loadingPhase !== 'fetching') return null;

  return (
    <div className="camera-flow-scan-feedback" role="status" aria-live="polite">
      {loadingPhase === 'reading' && <CameraFlowStatus phase="reading" />}
      {loadingPhase === 'fetching' && <CameraFlowStatus phase="fetching" />}
    </div>
  );
}
