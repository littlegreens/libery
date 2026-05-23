import { useEffect, useState } from 'react';
import { MdIcon } from '@/lib/material/md-react';
import { BOOK_ACTION_ICONS } from '@/lib/bookActions';
import { useFavoritesStore, type FavoriteBook } from '@/stores/favoritesStore';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';

type Props = {
  bookId: string;
  book?: FavoriteBook;
  variant?: 'corner' | 'inline';
  size?: number;
  className?: string;
};

/** Cuore preferiti (Material `favorite`). */
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
      toast.error('Preferito non aggiornato');
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
      aria-label={isFavorite ? 'Elimina dai preferiti' : 'Aggiungi ai preferiti'}
      aria-pressed={isFavorite}
      disabled={busy}
    >
      <MdIcon
        className="favorite-star__icon"
        style={{ fontSize: size, width: size, height: size }}
        aria-hidden
      >
        {isFavorite ? BOOK_ACTION_ICONS.favorite : BOOK_ACTION_ICONS.favoriteOutline}
      </MdIcon>
    </button>
  );
}
