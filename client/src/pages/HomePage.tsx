import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '@/components/BrandLogo';
import { LiberyButton } from '@/lib/material/md-react';

/** Splash iniziale (`/`): logo + Entra verso `/home`. Nessuno scroll. */
export default function HomePage() {
  const navigate = useNavigate();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="home-splash">
      <div className="home-splash__logo">
        <BrandLogo className="home-logo-large" />
      </div>
      <div className="home-splash__actions">
        <LiberyButton type="button" variant="secondary" onClick={() => navigate('/home')}>
          Entra
        </LiberyButton>
      </div>
    </div>
  );
}
