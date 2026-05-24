import { useSyncExternalStore } from 'react';
import { useAuthStore } from '@/stores/authStore';

/** Attende il ripristino sessione da localStorage (zustand persist). */
export function useAuthHydrated(): boolean {
  return useSyncExternalStore(
    useAuthStore.persist.onFinishHydration,
    () => useAuthStore.persist.hasHydrated(),
    () => false,
  );
}
