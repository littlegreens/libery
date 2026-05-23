import { MdIcon } from '@/lib/material/md-react';

type Props = {
  /** Testo opzionale sotto l’icona (evita «Caricamento…» se omesso). */
  label?: string;
  /** `page` = blocco centrato in pagina; `inline` = riga compatta; `overlay` = sopra contenuto. */
  variant?: 'page' | 'inline' | 'overlay';
  className?: string;
};

/** Indicatore attesa MD3: icona `progress_activity` animata su superficie elevata. */
export default function LiberyLoading({ label, variant = 'page', className }: Props) {
  return (
    <div
      className={['libery-loading', `libery-loading--${variant}`, className].filter(Boolean).join(' ')}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label ?? 'Caricamento in corso'}
    >
      <MdIcon className="libery-loading__icon">progress_activity</MdIcon>
      {label ? <span className="libery-loading__label">{label}</span> : null}
    </div>
  );
}
