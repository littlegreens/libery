import { CAMERA_GUIDE_LINES } from '@/lib/pointHelp';
import type { PointType } from '@/types/point';

type Props = {
  pointType?: PointType | string | null;
  variant?: 'default' | 'take' | 'leave';
};

export default function CameraFlowGuide({ pointType, variant = 'default' }: Props) {
  const certified = pointType === 'biblioteca' || pointType === 'libreria';
  const corner = pointType === 'corner_free';

  let lines: string[] = [CAMERA_GUIDE_LINES.intro];
  if (variant === 'leave') {
    lines.push(certified ? CAMERA_GUIDE_LINES.leaveCertified : CAMERA_GUIDE_LINES.leaveCorner);
  } else if (variant === 'take') {
    lines.push(certified ? CAMERA_GUIDE_LINES.takeCertified : CAMERA_GUIDE_LINES.takeCorner);
  } else if (certified) {
    lines.push(
      'In biblioteca/libreria: per ritirare o donare serve spesso il QR per l\'addetto. Per prenotare usa la lista del punto.',
    );
  } else if (corner) {
    lines.push('Nel corner puoi prendere e lasciare in autonomia inquadrando il codice a barre.');
  } else {
    lines.push(
      'Trova un libro → Lascia (donare) o vai in un punto per Prendere. Libro non censito? Portalo in un punto Libery.',
    );
  }

  return (
    <section className="camera-flow-guide" aria-label="Come usare la fotocamera">
      <h3 className="camera-flow-guide__title">Come funziona</h3>
      <ul className="camera-flow-guide__list mb-0">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}
