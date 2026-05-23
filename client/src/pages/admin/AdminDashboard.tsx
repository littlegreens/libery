import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getApiError } from '@/lib/apiError';
import { MdCard } from '@/lib/material/md-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

type Stats = {
  users: number;
  approvedPoints: number;
  pendingRequests: number;
  books: number;
};

export default function AdminDashboard() {
  useDocumentTitle('Dashboard admin');
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    setError(null);
    api
      .get('/admin/stats', { signal: ac.signal })
      .then((r) => setStats(r.data))
      .catch((err) => {
        if (ac.signal.aborted) return;
        setError(getApiError(err, 'Impossibile caricare le statistiche'));
      });
    return () => ac.abort();
  }, []);

  return (
    <div>
      <h1 className="h4 fw-bold mb-4">Dashboard</h1>
      {error ? (
        <p className="text-danger small mb-3" role="alert" aria-live="polite">
          {error}
        </p>
      ) : null}
      <div className="libery-stats-grid">
        {[
          { label: 'Utenti', value: stats?.users },
          { label: 'Punti attivi', value: stats?.approvedPoints },
          { label: 'Richieste in attesa', value: stats?.pendingRequests },
          { label: 'Libri in DB', value: stats?.books },
        ].map((s) => (
          <MdCard key={s.label} type="elevated" style={{ padding: '1rem', height: '100%' }}>
            <p className="small text-muted mb-1">{s.label}</p>
            <p className="h3 mb-0 fw-bold">{s.value ?? '—'}</p>
          </MdCard>
        ))}
      </div>
    </div>
  );
}
