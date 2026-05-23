import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AuthForm from '@/components/AuthForm';
import BrandLogo from '@/components/BrandLogo';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useAuthHydrated } from '@/hooks/useAuthHydrated';
import { useAuthStore } from '@/stores/authStore';
import LiberyLoading from '@/components/LiberyLoading';

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const hydrated = useAuthHydrated();
  const user = useAuthStore((s) => s.user);
  const [searchParams] = useSearchParams();
  const initialMode =
    location.pathname === '/registrati' || searchParams.get('mode') === 'register'
      ? 'register'
      : 'login';
  useDocumentTitle(initialMode === 'register' ? 'Registrati' : 'Accedi');

  if (!hydrated) {
    return (
      <div className="auth-page min-vh-100 d-flex align-items-center justify-content-center bg-white">
        <LiberyLoading variant="page" label="Caricamento…" />
      </div>
    );
  }

  if (user) {
    const from = (location.state as { from?: string } | null)?.from;
    if (from && user.role === 'admin' && from.startsWith('/admin')) {
      return <Navigate to={from} replace />;
    }
    if (user.role === 'admin') return <Navigate to="/admin" replace />;
    return <Navigate to="/mappa" replace />;
  }

  return (
    <div className="auth-page min-vh-100 d-flex flex-column bg-white">
      <header className="px-3 pt-3">
        <Link to="/" className="text-decoration-none text-muted small">
          ← Home
        </Link>
      </header>

      <main className="flex-grow-1 d-flex flex-column align-items-center justify-content-center px-4 pb-5">
        <BrandLogo className="mb-4 auth-logo" />

        <div className="auth-card w-100">
          <AuthForm
            initialMode={initialMode}
            onSuccess={() => navigate('/mappa')}
          />
        </div>
      </main>
    </div>
  );
}
