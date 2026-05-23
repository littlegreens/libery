/** Messaggio di stato fotocamera con puntini animati. */
export default function CameraFlowStatus({
  phase,
}: {
  phase: 'reading' | 'fetching';
}) {
  const label = phase === 'reading' ? 'Sto leggendo' : 'Recupero le informazioni';
  return (
    <p className="camera-flow-status camera-flow-status--reading" role="status">
      {label}
      <span className="camera-flow-dots" aria-hidden />
    </p>
  );
}
