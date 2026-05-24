import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { BOOK_ACTION_ICONS, BOOK_ACTION_LABELS } from '@/lib/bookActions';
import { useCloseOnScroll } from '@/lib/useCloseOnScroll';
import { MdIcon, MdIconButton } from '@/lib/material/md-react';
import { useAuthStore } from '@/stores/authStore';
import { useFavoritesStore, type FavoriteBook } from '@/stores/favoritesStore';

export type BookListRowMenuItems = {
  favorite?: {
    bookId: string;
    book?: FavoriteBook;
    onNeedLogin?: () => void;
  };
  /** Ritira / ricevi libro in punto (scanner QR). */
  prendi?: { onClick: () => void; disabled?: boolean; label?: string };
  prenota?: { onClick: () => void; disabled?: boolean; busy?: boolean };
  /** Annulla prenotazione. */
  annullaPrenotazione?: { onClick: () => void; disabled?: boolean; busy?: boolean };
  /** Lascia libro dallo zaino in un punto. */
  lasciaLibro?: { onClick: () => void; disabled?: boolean; busy?: boolean };
  /** Corner Free: libro in lista ma assente fisicamente. */
  nonCePiu?: { onClick: () => void; disabled?: boolean; busy?: boolean };
};

const MENU_BELOW = { anchorCorner: 'end-start', menuCorner: 'start-start' } as const;

type Props = {
  items: BookListRowMenuItems;
};

/** Menu ⋮ in alto a destra sulla riga libro. */
export default function BookListRowMenu({ items }: Props) {
  const uid = useId().replace(/:/g, '');
  const anchorId = `book-row-menu-${uid}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLElement & { open?: boolean }>(null);
  const [open, setOpen] = useState(false);

  useCloseOnScroll(open, () => setOpen(false), rootRef);

  const loggedIn = useAuthStore((s) => s.isLoggedIn());
  const isFavorite = useFavoritesStore((s) => s.ids.has(items.favorite?.bookId ?? ''));
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const [favBusy, setFavBusy] = useState(false);

  const hasFavorite = Boolean(items.favorite) && loggedIn;
  const hasRicevi = Boolean(items.prendi) && loggedIn;
  const hasPrenota = Boolean(items.prenota) && loggedIn;
  const hasAnnulla = Boolean(items.annullaPrenotazione) && loggedIn;
  const hasLasciaLibro = Boolean(items.lasciaLibro) && loggedIn;
  const hasNonCePiu = Boolean(items.nonCePiu) && loggedIn;
  const hasAny = hasFavorite || hasRicevi || hasPrenota || hasAnnulla || hasLasciaLibro || hasNonCePiu;

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const onClosed = () => setOpen(false);
    menu.addEventListener('closed', onClosed);
    return () => menu.removeEventListener('closed', onClosed);
  }, []);

  useEffect(() => {
    const menu = menuRef.current;
    if (menu && 'open' in menu) menu.open = open;
  }, [open]);

  if (!hasAny) return null;

  const closeAnd = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  const handleToggleOpen = () => setOpen((o) => !o);

  const handleFavorite = async () => {
    if (!items.favorite) return;
    if (!loggedIn) {
      items.favorite.onNeedLogin?.();
      setOpen(false);
      return;
    }
    if (favBusy) return;
    setFavBusy(true);
    try {
      await toggleFavorite(items.favorite.bookId, items.favorite.book);
    } catch {
      // toast già mostrato dallo store
    } finally {
      setFavBusy(false);
      setOpen(false);
    }
  };

  return (
    <div
      ref={rootRef}
      className="libery-book-list-row__menu"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <MdIconButton
        id={anchorId}
        type="button"
        color="standard"
        className="libery-book-list-row__menu-btn"
        aria-label="Azioni libro"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={handleToggleOpen}
      >
        <MdIcon>more_vert</MdIcon>
      </MdIconButton>

      <md-menu
        ref={menuRef as RefObject<HTMLElement>}
        className="libery-action-menu"
        anchor={anchorId}
        positioning="popover"
        quick
        has-overflow
        anchor-corner={MENU_BELOW.anchorCorner}
        menu-corner={MENU_BELOW.menuCorner}
      >
        {hasFavorite ? (
          <md-menu-item onClick={() => (favBusy ? undefined : void handleFavorite())}>
            <MdIcon slot="start">
              {isFavorite ? BOOK_ACTION_ICONS.eliminaPreferiti : BOOK_ACTION_ICONS.favoriteOutline}
            </MdIcon>
            <span slot="headline">
              {isFavorite ? BOOK_ACTION_LABELS.eliminaPreferiti : BOOK_ACTION_LABELS.preferito}
            </span>
          </md-menu-item>
        ) : null}
        {hasPrenota && !items.prenota?.disabled && !items.prenota?.busy ? (
          <md-menu-item onClick={() => closeAnd(() => items.prenota?.onClick())}>
            <MdIcon slot="start">{BOOK_ACTION_ICONS.prenota}</MdIcon>
            <span slot="headline">{BOOK_ACTION_LABELS.prenota}</span>
          </md-menu-item>
        ) : null}
        {hasRicevi && !items.prendi?.disabled ? (
          <md-menu-item onClick={() => closeAnd(() => items.prendi?.onClick())}>
            <MdIcon slot="start">{BOOK_ACTION_ICONS.ricevi}</MdIcon>
            <span slot="headline">{items.prendi?.label ?? BOOK_ACTION_LABELS.ricevi}</span>
          </md-menu-item>
        ) : null}
        {hasAnnulla && !items.annullaPrenotazione?.disabled && !items.annullaPrenotazione?.busy ? (
          <md-menu-item onClick={() => closeAnd(() => items.annullaPrenotazione?.onClick())}>
            <MdIcon slot="start">{BOOK_ACTION_ICONS.annullaPrenotazione}</MdIcon>
            <span slot="headline">{BOOK_ACTION_LABELS.annullaPrenotazione}</span>
          </md-menu-item>
        ) : null}
        {hasLasciaLibro && !items.lasciaLibro?.disabled && !items.lasciaLibro?.busy ? (
          <md-menu-item onClick={() => closeAnd(() => items.lasciaLibro?.onClick())}>
            <MdIcon slot="start">{BOOK_ACTION_ICONS.lascia}</MdIcon>
            <span slot="headline">{BOOK_ACTION_LABELS.dona}</span>
          </md-menu-item>
        ) : null}
        {hasNonCePiu && !items.nonCePiu?.disabled && !items.nonCePiu?.busy ? (
          <md-menu-item onClick={() => closeAnd(() => items.nonCePiu?.onClick())}>
            <MdIcon slot="start">{BOOK_ACTION_ICONS.nonCePiu}</MdIcon>
            <span slot="headline">{BOOK_ACTION_LABELS.nonCePiu}</span>
          </md-menu-item>
        ) : null}
      </md-menu>
    </div>
  );
}
