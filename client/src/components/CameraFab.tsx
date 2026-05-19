import LiberyIcon from '@/components/LiberyIcon';
import { icons } from '@/lib/assets';

type Props = {
  onClick: () => void;
};

export default function CameraFab({ onClick }: Props) {
  return (
    <button
      type="button"
      className="camera-fab"
      onClick={onClick}
      aria-label="Scansiona libro o punto"
    >
      <LiberyIcon src={icons.camera} className="camera-fab-icon" width={40} height={40} />
    </button>
  );
}
