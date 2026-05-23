import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AuthForm from '@/components/AuthForm';
import BrandLogo from '@/components/BrandLogo';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const initialMode =
    location.pathname === '/registrati' || searchParams.get('mode') === 'register'
      ? 'register'
      : 'login';
  useDocumentTitle(initialMode === 'register' ? 'Registrati' : 'Accedi');

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
