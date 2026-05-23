import { create } from 'zustand';

/** Snapshot minimo per riaprire la fotocamera dopo la scheda libro. */
export type CameraSessionSnapshot = {
  phase: string;
  flowMode: string;
  book: {
    id: string;
    isbn: string;
    title: string;
    author: string | null;
    year?: number | null;
    genre?: string | null;
    description?: string | null;
    coverPath?: string | null;
  } | null;
  point: {
    id: string;
    name: string;
    city: string | null;
    address: string | null;
    type: string;
  } | null;
  bookProvider?: string | null;
};

type CameraSessionState = {
  snapshot: CameraSessionSnapshot | null;
  saveSnapshot: (s: CameraSessionSnapshot) => void;
  consumeSnapshot: () => CameraSessionSnapshot | null;
};

export const useCameraSessionStore = create<CameraSessionState>((set, get) => ({
  snapshot: null,
  saveSnapshot: (s) => set({ snapshot: s }),
  consumeSnapshot: () => {
    const s = get().snapshot;
    set({ snapshot: null });
    return s;
  },
}));
