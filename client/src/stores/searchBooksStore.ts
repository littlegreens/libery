import { create } from 'zustand';
import type { BookAvailability } from '@/types/book';

export type SearchBookResult = {
  id: string;
  isbn: string;
  title: string;
  author: string | null;
  year: number | null;
  genre: string | null;
  publisher?: string | null;
  description?: string | null;
  coverPath?: string | null;
  source?: string;
  availability: BookAvailability[];
};

export type SearchIsbnLookup = {
  book: SearchBookResult;
  source: string;
  provider?: string;
  created: boolean;
};

export type SearchBooksSnapshot = {
  returnPath: string;
  q: string;
  books: SearchBookResult[];
  isbnResult: SearchIsbnLookup | null;
  searched: boolean;
  pickedId: string | null;
  error: string;
};

type SearchBooksState = {
  snapshot: SearchBooksSnapshot | null;
  save: (snapshot: SearchBooksSnapshot) => void;
  clear: () => void;
};

export const useSearchBooksStore = create<SearchBooksState>((set) => ({
  snapshot: null,
  save: (snapshot) => set({ snapshot }),
  clear: () => set({ snapshot: null }),
}));

/** `location.state` per tornare alla ricerca da scheda libro o punto. */
export function searchBooksBackState(returnPath: string) {
  return { from: { to: returnPath, label: 'Torna alla ricerca' } };
}

export function isSearchBooksPath(pathname: string): boolean {
  return pathname === '/libri' || pathname === '/cerca';
}
