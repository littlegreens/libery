import { useEffect, useState } from 'react';
import { useFavoritesStore, type FavoriteBook } from '@/stores/favoritesStore';
import { useAuthStore } from '@/stores/authStore';

type Props = {
  bookId: string;
  /** Dati opzionali del libro per popolare entries senza ricarica */
  book?: FavoriteBook;
  /** Posizionamento: 'corner' = assoluto top-right, 'inline' = bottone inline */
  variant?: 'corner' | 'inline';
  size?: number;
  className?: string;
};

/**
 * Stellina preferiti.
 *  - 'corner': posizionata top-right sopra una card relative; container parent deve essere position: relative.
 *  - 'inline': bottoncino standalone.
 *
 * Se l'utente non è loggato, cliccando la stella apriamo il modale auth (futuro);
 * per ora la nascondiamo.
 */
export default function FavoriteStar({
  bookId,
  book,
  variant = 'corner',
  size = 22,
  className,
}: Props) {
  const loggedIn = useAuthStore((s) => s.isLoggedIn());
  const isFavorite = useFavoritesStore((s) => s.ids.has(bookId));
  const loaded = useFavoritesStore((s) => s.loaded);
  const load = useFavoritesStore((s) => s.load);
  const toggle = useFavoritesStore((s) => s.toggle);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loggedIn && !loaded) void load();
  }, [loggedIn, loaded, load]);

  if (!loggedIn) return null;

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      await toggle(bookId, book);
    } catch {
      // store fa rollback
    } finally {
      setBusy(false);
    }
  };

  const cls = [
    variant === 'corner' ? 'favorite-star favorite-star--corner' : 'favorite-star favorite-star--inline',
    isFavorite ? 'is-active' : '',
    busy ? 'is-busy' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={cls}
      onClick={handleClick}
      aria-label={isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
      aria-pressed={isFavorite}
      disabled={busy}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-hidden
        fill={isFavorite ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path d="M12 2.5l2.95 5.98 6.6.96-4.78 4.66 1.13 6.57L12 17.6l-5.9 3.07 1.13-6.57L2.45 9.44l6.6-.96L12 2.5z" />
      </svg>
    </button>
  );
}
