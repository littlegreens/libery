import { create } from 'zustand';
import { api } from '@/lib/api';

export type SlotsSummary = {
  libriOggi: number;
  libriExtra: number;
  libriTotali: number;
  activeReservations: number;
  slotsFree: number;
};

type SlotsState = {
  slots: SlotsSummary | null;
  refreshSlots: () => Promise<SlotsSummary | null>;
};

export const useSlotsStore = create<SlotsState>((set) => ({
  slots: null,

  refreshSlots: async () => {
    try {
      const { data } = await api.get<{ slots: SlotsSummary }>('/user/slots');
      set({ slots: data.slots });
      return data.slots;
    } catch {
      return null;
    }
  },
}));
