import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '@/components/BrandLogo';

/**
 * Splash screen iniziale: logo + bottone "Entra" che porta alla landing /home.
 * È volutamente semplice e non dipende dall'AppShell (è la prima cosa che vede l'utente).
 */
export default function HomePage() {
  const navigate = useNavigate();

  useEffect(() => {
    document.body.style.overflow = '';
  }, []);

  return (
    <div className="home-page">
      <div className="home-logo-wrap">
        <BrandLogo className="home-logo-large" />
      </div>

      <div className="home-actions">
        <button type="button" className="home-entra-btn" onClick={() => navigate('/home')}>
          Entra
        </button>
      </div>
    </div>
  );
}
