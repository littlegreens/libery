import { FormEvent, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { LiberyButton, MdTextField } from '@/lib/material/md-react';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { api } from '@/lib/api';
import { getApiError } from '@/lib/apiError';
import type { ShellOutletContext } from '@/components/AppShell';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

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

const EMPTY_CONTACT = { nome: '', email: '', messaggio: '' };

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function WelcomePage() {
  useDocumentTitle('Home');
  const navigate = useNavigate();
  const { openAuthSheet } = useOutletContext<ShellOutletContext>();
  const loggedIn = useAuthStore((s) => s.isLoggedIn());

  const chiSiamoRef = useRef<HTMLElement>(null);
  const contattiRef = useRef<HTMLElement>(null);
  const contactFormRef = useRef<HTMLFormElement>(null);

  const [contactForm, setContactForm] = useState(EMPTY_CONTACT);
  const [sending, setSending] = useState(false);

  function scrollTo(ref: React.RefObject<HTMLElement | null>) {
    ref.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function handleContact(e: FormEvent) {
    e.preventDefault();
    const nome = contactForm.nome.trim();
    const email = contactForm.email.trim();
    const messaggio = contactForm.messaggio.trim();

    if (!nome) {
      toast.warning('Inserisci il nome');
      return;
    }
    if (!email) {
      toast.warning('Inserisci l\'email');
      return;
    }
    if (!isValidEmail(email)) {
      toast.warning('Email non valida');
      return;
    }
    if (!messaggio) {
      toast.warning('Inserisci un messaggio');
      return;
    }

    setSending(true);
    try {
      await api.post('/contact', { name: nome, email, message: messaggio });
      setContactForm(EMPTY_CONTACT);
      toast.success('Messaggio inviato. Ti risponderemo il prima possibile.');
    } catch (err) {
      toast.error(getApiError(err, 'Invio non riuscito'));
    } finally {
      setSending(false);
    }
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

          <form
            ref={contactFormRef}
            className="welcome-contact__form libery-field-stack"
            onSubmit={(e) => void handleContact(e)}
            noValidate
          >
            <MdTextField
              style={{ width: '100%' }}
              label="Nome"
              type="text"
              value={contactForm.nome}
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
              onInput={(e: Event) =>
                setContactForm((f) => ({
                  ...f,
                  email: (e.currentTarget as HTMLElement & { value: string }).value,
                }))
              }
            />
            <div className="welcome-contact__message-field">
              <label htmlFor="welcome-contact-message" className="welcome-contact__message-label">
                Messaggio
              </label>
              <textarea
                id="welcome-contact-message"
                className="libery-field-textarea"
                rows={5}
                value={contactForm.messaggio}
                disabled={sending}
                aria-required="true"
                onChange={(e) =>
                  setContactForm((f) => ({
                    ...f,
                    messaggio: e.target.value,
                  }))
                }
              />
            </div>
            <LiberyButton
              type="button"
              variant="primary"
              disabled={sending}
              onClick={() => contactFormRef.current?.requestSubmit()}
            >
              {sending ? 'Invio…' : 'Invia'}
            </LiberyButton>
          </form>

        </div>
      </section>
    </div>
  );
}
