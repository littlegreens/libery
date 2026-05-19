import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { POINT_TYPE_LABELS } from '@/lib/mapIcons';

type ManagerPoint = {
  id: string;
  name: string;
  city: string | null;
  type: string;
};

export default function ManagerPage() {
  const [point, setPoint] = useState<ManagerPoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<{ point: ManagerPoint }>('/manager/point');
      setPoint(data.point);
    } catch {
      setError('Impossibile caricare il punto assegnato');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="page-content manager-page px-3 py-3">
      <h1 className="h5 fw-bold mb-1">Il mio punto</h1>
      <p className="small text-muted mb-3">
        Da qui scansioni il QR dell'utente per confermare consegne e ritiri.
      </p>

      {loading && <p className="text-muted">Caricamento…</p>}
      {error && <p className="text-danger">{error}</p>}

      {point && (
        <section className="camera-flow-card mb-3">
          <span className="badge text-bg-light mb-2">
            {POINT_TYPE_LABELS[point.type as keyof typeof POINT_TYPE_LABELS] ?? point.type}
          </span>
          <h2 className="h6 fw-bold mb-0">{point.name}</h2>
          {point.city && <p className="small text-muted mb-0">{point.city}</p>}
        </section>
      )}

      <div className="alert alert-info small">
        Lo SCAN dell'addetto sarà disponibile a breve. La coda di validazione è stata sostituita
        dal flusso "Ricevuto / Consegnato" tramite QR utente.
      </div>
    </div>
  );
}
