import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { MdCard } from '@/lib/material/md-react';

type Stats = {
  users: number;
  approvedPoints: number;
  pendingRequests: number;
  books: number;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.get('/admin/stats').then((r) => setStats(r.data));
  }, []);

  return (
    <div>
      <h1 className="h4 fw-bold mb-4">Dashboard</h1>
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
