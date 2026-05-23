type Props = {
  value: number | string;
  className?: string;
  /** Se true, non renderizza nulla quando il valore numerico è 0. */
  hideZero?: boolean;
  'aria-label'?: string;
};

/** Chip rotonda verde per conteggi (copie, tab zaino, libri disponibili, profilo). */
export default function LiberyNumChip({ value, className, hideZero, 'aria-label': ariaLabel }: Props) {
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (hideZero && (Number.isNaN(n) ? false : n <= 0)) return null;

  return (
    <span
      className={['libery-num-chip', className].filter(Boolean).join(' ')}
      aria-label={ariaLabel}
    >
      {value}
    </span>
  );
}
