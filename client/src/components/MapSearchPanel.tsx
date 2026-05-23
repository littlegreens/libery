import { FormEvent } from 'react';
import LiberyOutlinedSearchField from '@/components/LiberyOutlinedSearchField';
import { MdIcon, MdIconButton } from '@/lib/material/md-react';

type Props = {
  bookQuery: string;
  onBookQueryChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  loadingPoints: boolean;
  searchLoading: boolean;
  userPos: { lat: number; lng: number } | null;
  mapReady: boolean;
  onLocate: () => void;
};

export default function MapSearchPanel({
  bookQuery,
  onBookQueryChange,
  onSubmit,
  loadingPoints,
  searchLoading,
  userPos,
  mapReady,
  onLocate,
}: Props) {
  const showStatus = loadingPoints || (searchLoading && bookQuery.trim().length > 0);
  const statusLabel = loadingPoints ? 'Caricamento punti sulla mappa…' : 'Ricerca libri…';

  return (
    <div className="map-search-bar">
      <div className="map-search-panel">
        <form className="map-search-form" onSubmit={onSubmit}>
          <LiberyOutlinedSearchField
            id="map-book-search"
            label="Cerca libro"
            placeholder="Titolo, autore, ISBN…"
            value={bookQuery}
            onValueChange={onBookQueryChange}
            className="libery-search-field map-search-field"
            disabled={loadingPoints}
          />
        </form>
        {showStatus ? (
          <div className="map-search-inline-status" role="status" aria-live="polite">
            <MdIcon className="map-search-inline-status__icon">progress_activity</MdIcon>
            <span>{statusLabel}</span>
          </div>
        ) : null}
      </div>
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
