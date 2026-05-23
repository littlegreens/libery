import { useState } from 'react';
import type { PointType } from '@/types/point';
import type { PointRequestDraft } from '@/lib/pointRequestDraft';
import { LiberyButton, MdTextField } from '@/lib/material/md-react';

type Props = {
  value: PointRequestDraft;
  onChange: (next: PointRequestDraft) => void;
  onLater: () => void;
  fieldError?: string | null;
};

function readFieldValue(e: Event) {
  return (e.currentTarget as HTMLElement & { value: string }).value;
}

export default function RegisterPointPanel({ value, onChange, onLater, fieldError }: Props) {
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsHint, setGpsHint] = useState('');

  function patch(partial: Partial<PointRequestDraft>) {
    onChange({ ...value, ...partial });
  }

  function useMyLocation() {
    setGpsHint('');
    if (!navigator.geolocation) {
      setGpsHint('Il GPS non è disponibile su questo dispositivo.');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        patch({
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        });
        setGpsHint('Coordinate acquisite dal GPS.');
        setGpsLoading(false);
      },
      () => {
        setGpsHint(
          'Non riesco a leggere la posizione. Abilita il GPS nelle impostazioni o inserisci l\'indirizzo.',
        );
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60_000 },
    );
  }

  return (
    <div className="auth-point-panel" role="region" aria-labelledby="auth-point-panel-title">
      <h3 id="auth-point-panel-title" className="auth-point-panel__title">
        Proponi un luogo
      </h3>
      <p className="auth-point-panel__lead small text-muted mb-0">
        Compila i dati del punto che gestirai. Servono indirizzo <strong>oppure</strong> coordinate GPS.
      </p>

      <label className="auth-point-panel__label" htmlFor="reg-point-type">
        Tipo
      </label>
      <select
        id="reg-point-type"
        className="libery-select mb-2"
        value={value.pointType}
        onChange={(e) => patch({ pointType: e.target.value as PointType })}
      >
        <option value="biblioteca">Biblioteca</option>
        <option value="libreria">Libreria</option>
        <option value="corner_free">Corner Free</option>
      </select>

      <MdTextField
        className="mb-2"
        style={{ width: '100%' }}
        label="Nome del luogo"
        value={value.name}
        required
        onInput={(e: Event) => patch({ name: readFieldValue(e) })}
      />
      <MdTextField
        className="mb-2"
        style={{ width: '100%' }}
        label="Città"
        value={value.city}
        onInput={(e: Event) => patch({ city: readFieldValue(e) })}
      />
      <MdTextField
        className="mb-2"
        style={{ width: '100%' }}
        label="Indirizzo"
        value={value.address}
        supportingText="Obbligatorio se non usi il GPS"
        onInput={(e: Event) => patch({ address: readFieldValue(e) })}
      />

      <div className="auth-point-panel__gps-row">
        <LiberyButton
          type="button"
          variant="secondary"
          size="small"
          disabled={gpsLoading}
          onClick={() => void useMyLocation()}
        >
          <span className="material-symbols-outlined" aria-hidden>
            my_location
          </span>
          {gpsLoading ? 'GPS…' : 'Usa la mia posizione'}
        </LiberyButton>
      </div>

      <div className="auth-point-panel__coords">
        <MdTextField
          style={{ width: '100%' }}
          label="Latitudine"
          type="text"
          value={value.latitude}
          onInput={(e: Event) => patch({ latitude: readFieldValue(e) })}
        />
        <MdTextField
          style={{ width: '100%' }}
          label="Longitudine"
          type="text"
          value={value.longitude}
          onInput={(e: Event) => patch({ longitude: readFieldValue(e) })}
        />
      </div>

      {gpsHint ? <p className="auth-point-panel__hint small mb-0">{gpsHint}</p> : null}
      {fieldError ? (
        <p className="auth-point-panel__error small mb-0" role="alert">
          {fieldError}
        </p>
      ) : null}

      <MdTextField
        className="mb-2"
        style={{ width: '100%' }}
        label="Telefono contatto (opzionale)"
        type="tel"
        value={value.contactPhone}
        onInput={(e: Event) => patch({ contactPhone: readFieldValue(e) })}
      />

      <button type="button" className="auth-point-panel__later" onClick={onLater}>
        Lo farò in un secondo momento
      </button>
    </div>
  );
}
