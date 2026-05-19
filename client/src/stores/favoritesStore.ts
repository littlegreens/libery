import { create } from 'zustand';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

/**
 * Store globale dei preferiti: tiene un Set di bookId per accesso O(1) dalle card libro.
 * Le mutation chiamano l'API user/favorites e fanno optimistic update.
 */
export type FavoriteBook = {
  id: string;
  isbn: string;
  title: string;
  author: string | null;
  year: number | null;
  genre: string | null;
  coverPath: string | null;
};

export type FavoriteEntry = {
  bookId: string;
  favoritedAt: string;
  book: FavoriteBook;
};

type FavoritesState = {
  /** Set di bookId preferiti, popolato da loadFavorites */
  ids: Set<string>;
  entries: FavoriteEntry[];
  loaded: boolean;
  loading: boolean;
  /** Carica i preferiti dal server. Idempotente. */
  load: (force?: boolean) => Promise<void>;
  isFavorite: (bookId: string) => boolean;
  /** Toggle: se è preferito lo rimuove, altrimenti lo aggiunge. Ottimistico. */
  toggle: (bookId: string, book?: FavoriteBook) => Promise<boolean>;
  reset: () => void;
};

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  ids: new Set<string>(),
  entries: [],
  loaded: false,
  loading: false,

  isFavorite: (bookId) => get().ids.has(bookId),

  load: async (force = false) => {
    if (!useAuthStore.getState().isLoggedIn()) {
      set({ ids: new Set(), entries: [], loaded: true, loading: false });
      return;
    }
    if (get().loaded && !force) return;
    if (get().loading) return;
    set({ loading: true });
    try {
      const { data } = await api.get<{ favorites: FavoriteEntry[] }>('/user/favorites');
      set({
        entries: data.favorites,
        ids: new Set(data.favorites.map((f) => f.bookId)),
        loaded: true,
      });
    } catch {
      set({ entries: [], ids: new Set(), loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  toggle: async (bookId, book) => {
    const wasFavorite = get().ids.has(bookId);
    // Optimistic update
    const nextIds = new Set(get().ids);
    let nextEntries = get().entries;
    if (wasFavorite) {
      nextIds.delete(bookId);
      nextEntries = get().entries.filter((e) => e.bookId !== bookId);
    } else {
      nextIds.add(bookId);
      if (book) {
        nextEntries = [
          { bookId, favoritedAt: new Date().toISOString(), book },
          ...get().entries.filter((e) => e.bookId !== bookId),
        ];
      }
    }
    set({ ids: nextIds, entries: nextEntries });

    try {
      if (wasFavorite) {
        await api.delete(`/user/favorites/${bookId}`);
      } else {
        await api.post(`/user/favorites/${bookId}`);
        // Se non avevamo i dati del libro, ricarica per arricchire entries
        if (!book) await get().load(true);
      }
      return !wasFavorite;
    } catch (err) {
      // rollback
      const rollback = new Set(get().ids);
      if (wasFavorite) rollback.add(bookId);
      else rollback.delete(bookId);
      set({ ids: rollback });
      throw err;
    }
  },

  reset: () => set({ ids: new Set(), entries: [], loaded: false, loading: false }),
}));

// Auto-load quando l'utente fa login / reset al logout.
useAuthStore.subscribe((state, prevState) => {
  const wasLoggedIn = Boolean(prevState.user);
  const isLoggedIn = Boolean(state.user);
  if (isLoggedIn && !wasLoggedIn) {
    void useFavoritesStore.getState().load(true);
  } else if (!isLoggedIn && wasLoggedIn) {
    useFavoritesStore.getState().reset();
  }
});
