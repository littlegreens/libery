import { MdIcon, MdIconButton } from '@/lib/material/md-react';

type Props = {
  userPos: { lat: number; lng: number } | null;
  mapReady: boolean;
  onLocate: () => void;
};

/** Barra mappa: solo centra sulla posizione utente. */
export default function MapLocateBar({ userPos, mapReady, onLocate }: Props) {
  return (
    <div className="map-locate-bar">
      <MdIconButton
        type="button"
        className="map-locate-icon-btn"
        color="standard"
        aria-label="Centra sulla mia posizione"
        disabled={!userPos || !mapReady}
        title="Centra sulla mia posizione"
        onClick={onLocate}
      >
        <MdIcon>my_location</MdIcon>
      </MdIconButton>
    </div>
  );
}
