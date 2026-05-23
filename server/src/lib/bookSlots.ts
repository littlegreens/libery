import { prisma } from './prisma.js';

export const SLOT_DEFAULT_DAILY = 1;

/** Slot Libri disponibili: 1 al giorno + extra da donazioni. */
export function computeSlots(libriOggiUsed: number, libriExtra: number) {
  const libriOggi = Math.max(0, SLOT_DEFAULT_DAILY - libriOggiUsed);
  const libriExtraClamped = Math.max(0, libriExtra);
  const libriTotali = libriOggi + libriExtraClamped;
  return { libriOggi, libriExtra: libriExtraClamped, libriTotali };
}

export function slotsFree(libriTotali: number, activeReservations: number) {
  return Math.max(0, libriTotali - activeReservations);
}

export async function countActiveReservations(userId: string): Promise<number> {
  return prisma.reservation.count({
    where: {
      userId,
      status: 'active',
      expiresAt: { gt: new Date() },
    },
  });
}

export async function getUserSlotSummary(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { libriOggiUsed: true, libriExtra: true },
  });
  if (!user) return null;
  const slots = computeSlots(user.libriOggiUsed, user.libriExtra);
  const activeReservations = await countActiveReservations(userId);
  return {
    ...slots,
    activeReservations,
    slotsFree: slotsFree(slots.libriTotali, activeReservations),
  };
}
