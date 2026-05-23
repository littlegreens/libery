import { FormEvent, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { LiberyButton, MdTextField } from '@/lib/material/md-react';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import type { ShellOutletContext } from '@/components/AppShell';

const HOME_LOGO_SRC = '/libery_logo_white.png';

const WELCOME_STEPS = [
  {
    title: 'Scopri',
    icon: 'explore',
    body: 'Trova i punti libery vicino a te',
  },
  {
    title: 'Scambia',
    icon: 'qr_code_scanner',
    body: 'Prenota o scansiona il codice del libro per prenderlo o lasciarlo',
  },
  {
    title: 'Leggi',
    icon: 'menu_book',
    body: 'Buona lettura, quando hai finito se vuoi rimettilo nel circuito libery',
  },
] as const;

export default function WelcomePage() {
  const navigate = useNavigate();
  const { openAuthSheet } = useOutletContext<ShellOutletContext>();
  const loggedIn = useAuthStore((s) => s.isLoggedIn());

  const chiSiamoRef = useRef<HTMLElement>(null);
  const contattiRef = useRef<HTMLElement>(null);

  const [contactForm, setContactForm] = useState({ nome: '', email: '', messaggio: '' });

  function scrollTo(ref: React.RefObject<HTMLElement | null>) {
    ref.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function handleContact(e: FormEvent) {
    e.preventDefault();
    // TODO: collegare a un endpoint /api/contact quando disponibile
    setContactForm({ nome: '', email: '', messaggio: '' });
    toast.success('Messaggio inviato. Ti risponderemo il prima possibile.');
  }

  return (
    <div className="welcome-page">

      <section className="welcome-hero">
        <div className="welcome-hero__overlay" aria-hidden />

        <div className="welcome-hero__inner">
          <div className="welcome-hero__brand">
            <img
              src={HOME_LOGO_SRC}
              alt="libery — cerca, scambia, leggi"
              className="welcome-hero__logo"
              width={320}
              height={120}
              decoding="async"
            />
          </div>

          <div className="welcome-hero__actions">
            {loggedIn ? (
              <div className="welcome-hero__cta-group">
                <LiberyButton
                  type="button"
                  variant="primary"
                  className="welcome-hero__cta-btn"
                  onClick={() => navigate('/mappa')}
                >
                  <span className="material-symbols-outlined" aria-hidden>explore</span>
                  Mappa
                </LiberyButton>
                <LiberyButton
                  type="button"
                  variant="secondary"
                  className="welcome-hero__cta-btn"
                  onClick={() => navigate('/libri')}
                >
                  <span className="material-symbols-outlined" aria-hidden>menu_book</span>
                  Cerca un libro
                </LiberyButton>
              </div>
            ) : (
              <LiberyButton
                type="button"
                variant="primary"
                className="welcome-hero__cta-btn"
                onClick={() => openAuthSheet('login')}
              >
                Entra
              </LiberyButton>
            )}
          </div>
        </div>

        <button
          type="button"
          className="welcome-section-chevron welcome-section-chevron--on-dark"
          aria-label="Scopri di più"
          onClick={() => scrollTo(chiSiamoRef)}
        >
          <span className="material-symbols-outlined">expand_more</span>
        </button>
      </section>

      <section className="welcome-about" ref={chiSiamoRef}>
        <div className="welcome-about__inner">
          <h2 className="welcome-about__title">Cos&apos;è libery?</h2>
          <p className="welcome-about__body">
            libery rimette in circolazione i libri. Lascia quelli che hai finito, prendi quelli che
            vuoi leggere — gratis, nelle biblioteche, librerie e corner della tua città.
          </p>

          <ol className="welcome-about__steps">
            {WELCOME_STEPS.map((step) => (
              <li key={step.title} className="welcome-about__step">
                <span className="material-symbols-outlined welcome-about__step-icon" aria-hidden>
                  {step.icon}
                </span>
                <div className="welcome-about__step-text">
                  <span className="welcome-about__step-title">{step.title}</span>
                  <p className="welcome-about__step-body">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <button
          type="button"
          className="welcome-section-chevron welcome-section-chevron--on-light"
          aria-label="Contatti"
          onClick={() => scrollTo(contattiRef)}
        >
          <span className="material-symbols-outlined">expand_more</span>
        </button>
      </section>

      <section className="welcome-contact" ref={contattiRef}>
        <div className="welcome-contact__inner">
          <h2 className="welcome-contact__title">Scrivici</h2>
          <p className="welcome-contact__sub">
            Vuoi proporre un nuovo punto? Hai domande o suggerimenti? Siamo qui.
          </p>

          <form className="welcome-contact__form" onSubmit={handleContact}>
            <MdTextField
              style={{ width: '100%' }}
              label="Nome"
              type="text"
              value={contactForm.nome}
              required
              onInput={(e: Event) =>
                setContactForm((f) => ({
                  ...f,
                  nome: (e.currentTarget as HTMLElement & { value: string }).value,
                }))
              }
            />
            <MdTextField
              style={{ width: '100%' }}
              label="Email"
              type="email"
              value={contactForm.email}
              required
              onInput={(e: Event) =>
                setContactForm((f) => ({
                  ...f,
                  email: (e.currentTarget as HTMLElement & { value: string }).value,
                }))
              }
            />
            <MdTextField
              style={{ width: '100%' }}
              label="Messaggio"
              type="text"
              value={contactForm.messaggio}
              required
              onInput={(e: Event) =>
                setContactForm((f) => ({
                  ...f,
                  messaggio: (e.currentTarget as HTMLElement & { value: string }).value,
                }))
              }
            />
            <LiberyButton type="submit" variant="primary">
              Invia
            </LiberyButton>
          </form>

        </div>
      </section>
    </div>
  );
}
