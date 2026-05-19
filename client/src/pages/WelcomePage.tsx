import { FormEvent, useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { api } from '@/lib/api';
import { useAuthStore, type AuthUser } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import type { ShellOutletContext } from '@/components/AppShell';

type LoginResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

/**
 * Landing page a 4 sezioni full-screen con scroll-snap verticale.
 *  1) Presentazione
 *  2) Come funziona (con icone)
 *  3) Login (se non loggato) / saluto (se loggato)
 *  4) Contatti
 *
 * Ogni sezione ha una freccia in basso che scrolla a quella successiva.
 */
export default function WelcomePage() {
  const navigate = useNavigate();
  const { openAuthSheet } = useOutletContext<ShellOutletContext>();
  const loggedIn = useAuthStore((s) => s.isLoggedIn());
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);

  const sectionsRef = useRef<HTMLDivElement>(null);
  const sec1 = useRef<HTMLElement>(null);
  const sec2 = useRef<HTMLElement>(null);
  const sec3 = useRef<HTMLElement>(null);
  const sec4 = useRef<HTMLElement>(null);

  function scrollTo(el: HTMLElement | null) {
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Login inline (sezione 3)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    if (loginBusy) return;
    setLoginBusy(true);
    try {
      const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
      setAuth({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
      toast.success(`Bentornato${data.user.displayName ? ', ' + data.user.displayName : ''}!`, {
        title: 'Accesso effettuato',
      });
      navigate('/mappa');
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error ?? 'Credenziali non valide'
        : 'Errore di rete';
      toast.error(msg, { title: 'Accesso fallito' });
    } finally {
      setLoginBusy(false);
    }
  }

  // Contatti (sezione 4) — placeholder, mostra toast
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');

  function handleContact(e: FormEvent) {
    e.preventDefault();
    toast.success('Grazie! Ti ricontatteremo a breve.', { title: 'Messaggio inviato' });
    setContactName('');
    setContactEmail('');
    setContactMessage('');
  }

  return (
    <div className="welcome" ref={sectionsRef}>
      {/* Sezione 1 — Presentazione */}
      <section className="welcome-section welcome-section--hero" ref={sec1}>
        <div className="welcome-section-inner">
          <h1 className="welcome-title">Libery</h1>
          <p className="welcome-lead">
            La rete italiana per scambiare libri liberamente. Prendi, leggi, lascia.
          </p>
          <p className="welcome-desc">
            Migliaia di libri nascosti negli angoli del tuo quartiere: biblioteche partner,
            librerie del circuito e corner di strada. Nessun costo, nessuna iscrizione costosa —
            solo libri che girano.
          </p>
          <div className="welcome-cta">
            <Link to="/mappa" className="btn btn-libery">Esplora la mappa</Link>
            <button type="button" className="btn btn-outline-secondary" onClick={() => scrollTo(sec2.current)}>
              Scopri come funziona
            </button>
          </div>
        </div>
        <button type="button" className="welcome-arrow" onClick={() => scrollTo(sec2.current)} aria-label="Vai alla sezione successiva">
          <Chevron />
        </button>
      </section>

      {/* Sezione 2 — Come funziona */}
      <section className="welcome-section welcome-section--how" ref={sec2}>
        <div className="welcome-section-inner">
          <h2 className="welcome-section-title">Come funziona</h2>
          <p className="welcome-section-sub">Quattro gesti semplici, ovunque tu sia.</p>
          <ul className="welcome-features">
            <li>
              <span className="welcome-feature-icon"><IconMap /></span>
              <h3>Trova</h3>
              <p>Apri la mappa e scopri biblioteche, librerie e corner liberi vicino a te.</p>
            </li>
            <li>
              <span className="welcome-feature-icon"><IconHand /></span>
              <h3>Prendi</h3>
              <p>Inquadri il QR del punto o del libro e lo metti nel tuo Zaino digitale.</p>
            </li>
            <li>
              <span className="welcome-feature-icon"><IconBookmark /></span>
              <h3>Lascia</h3>
              <p>Quando hai finito, deposita il libro in qualunque punto Libery del circuito.</p>
            </li>
            <li>
              <span className="welcome-feature-icon"><IconPlane /></span>
              <h3>Colleziona Aeroplanini</h3>
              <p>Più libri muovi, più riconoscimenti ottieni nel tuo profilo.</p>
            </li>
          </ul>
        </div>
        <button type="button" className="welcome-arrow" onClick={() => scrollTo(sec3.current)} aria-label="Vai alla sezione successiva">
          <Chevron />
        </button>
      </section>

      {/* Sezione 3 — Login o saluto */}
      <section className="welcome-section welcome-section--login" ref={sec3}>
        <div className="welcome-section-inner welcome-section-inner--narrow">
          {loggedIn ? (
            <>
              <h2 className="welcome-section-title">
                Ciao{user?.displayName ? `, ${user.displayName}` : ''}!
              </h2>
              <p className="welcome-section-sub">Sei già dentro. Vai dove vuoi.</p>
              <div className="welcome-cta">
                <Link to="/mappa" className="btn btn-libery">Mappa</Link>
                <Link to="/zaino" className="btn btn-outline-secondary">Il tuo Zaino</Link>
                <Link to="/profilo" className="btn btn-outline-secondary">Profilo</Link>
              </div>
            </>
          ) : (
            <>
              <h2 className="welcome-section-title">Entra in Libery</h2>
              <p className="welcome-section-sub">Accedi al tuo account o registrati per iniziare.</p>
              <form onSubmit={handleLogin} className="welcome-login-form" autoComplete="on">
                <label className="form-label small mb-1" htmlFor="welcome-email">Email</label>
                <input
                  id="welcome-email"
                  type="email"
                  className="form-control mb-2"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
                <label className="form-label small mb-1" htmlFor="welcome-pass">Password</label>
                <input
                  id="welcome-pass"
                  type="password"
                  className="form-control mb-3"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button type="submit" className="btn btn-libery w-100" disabled={loginBusy}>
                  {loginBusy ? 'Accesso…' : 'Accedi'}
                </button>
                <div className="d-flex justify-content-between mt-3 small">
                  <button
                    type="button"
                    className="btn btn-link p-0"
                    onClick={() => openAuthSheet('register')}
                  >
                    Non hai un account? Registrati
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
        <button type="button" className="welcome-arrow" onClick={() => scrollTo(sec4.current)} aria-label="Vai alla sezione successiva">
          <Chevron />
        </button>
      </section>

      {/* Sezione 4 — Contatti */}
      <section className="welcome-section welcome-section--contact" ref={sec4}>
        <div className="welcome-section-inner welcome-section-inner--narrow">
          <h2 className="welcome-section-title">Contatti</h2>
          <p className="welcome-section-sub">
            Hai un punto da proporre o vuoi collaborare? Scrivici.
          </p>
          <form onSubmit={handleContact} className="welcome-contact-form">
            <label className="form-label small mb-1" htmlFor="contact-name">Nome</label>
            <input
              id="contact-name"
              type="text"
              className="form-control mb-2"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              required
            />
            <label className="form-label small mb-1" htmlFor="contact-email">Email</label>
            <input
              id="contact-email"
              type="email"
              className="form-control mb-2"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              required
            />
            <label className="form-label small mb-1" htmlFor="contact-msg">Messaggio</label>
            <textarea
              id="contact-msg"
              className="form-control mb-3"
              rows={4}
              value={contactMessage}
              onChange={(e) => setContactMessage(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-libery w-100">Invia</button>
          </form>
        </div>
        <button type="button" className="welcome-arrow welcome-arrow--up" onClick={() => scrollTo(sec1.current)} aria-label="Torna in cima">
          <Chevron />
        </button>
      </section>
    </div>
  );
}

/* --- icone inline --- */

function Chevron() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function IconMap() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 6v15l7-3 8 3 7-3V3l-7 3-8-3-7 3z" />
      <path d="M8 3v15" />
      <path d="M16 6v15" />
    </svg>
  );
}

function IconHand() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 11V6a2 2 0 0 0-4 0v5" />
      <path d="M14 10V4a2 2 0 0 0-4 0v6" />
      <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
      <path d="M18 8a2 2 0 0 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.61-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </svg>
  );
}

function IconBookmark() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconPlane() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
    </svg>
  );
}
