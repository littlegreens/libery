import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BackTarget } from '@/components/BackLink';
import { useBackTarget } from '@/components/BackLink';
import { MdIcon, MdIconButton } from '@/lib/material/md-react';

export type LiberyContextualTopBarConfig = {
  title: string;
  /** Opzionale: solo screen reader (`visually-hidden`), niente seconda riga visibile nell’app bar. */
  subtitle?: string;
  /** Default: indietro visibile (`true`). */
  showBack?: boolean;
  /** Se true: barra solo freccia + trailing (titolo nella pagina). */
  hideTitle?: boolean;
  backFallback?: BackTarget;
  /** Se impostato, sostituisce la navigazione predefinita del pulsante indietro. */
  onBack?: () => void;
  /** Es. info, condividi, preferiti. */
  trailing?: ReactNode;
};

function NavBackInline({ fallback, onBack }: { fallback?: BackTarget; onBack?: () => void }) {
  const navigate = useNavigate();
  const target = useBackTarget(fallback);
  return (
    <MdIconButton
      type="button"
      color="standard"
      className="libery-contextual-top-bar__back-btn"
      aria-label={target.label}
      onClick={() => (onBack ? onBack() : navigate(target.to, { replace: true }))}
    >
      <MdIcon>arrow_back</MdIcon>
    </MdIconButton>
  );
}

/** Fascia contestuale M3 compact: solo freccia (icon button) + titolo + trailing. Nessun testo accanto alla freccia. */
export default function LiberyContextualTopBar({ config }: { config: LiberyContextualTopBarConfig }) {
  const showBack = config.showBack !== false;
  const hideTitle = config.hideTitle === true;

  return (
    <div
      className={['libery-contextual-top-bar', hideTitle ? 'libery-contextual-top-bar--actions-only' : '']
        .filter(Boolean)
        .join(' ')}
      aria-label={config.title}
    >
      {showBack ? (
        <div className="libery-contextual-top-bar__leading">
          <NavBackInline fallback={config.backFallback} onBack={config.onBack} />
        </div>
      ) : null}
      {hideTitle ? (
        <div className="libery-contextual-top-bar__spacer" aria-hidden />
      ) : (
        <div className="libery-contextual-top-bar__text min-w-0">
          <h1 className="libery-contextual-top-bar__title">{config.title}</h1>
          {config.subtitle ? (
            <p className="libery-contextual-top-bar__subtitle visually-hidden">{config.subtitle}</p>
          ) : null}
        </div>
      )}
      {config.trailing ? (
        <div className="libery-contextual-top-bar__trailing flex-shrink-0">{config.trailing}</div>
      ) : null}
    </div>
  );
}
