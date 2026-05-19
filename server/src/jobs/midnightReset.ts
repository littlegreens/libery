import { prisma } from '../lib/prisma.js';

/**
 * Reset giornaliero degli slot "libri_oggi".
 * Schedulato via BullMQ a mezzanotte Europe/Rome.
 */
export async function runMidnightReset(): Promise<{ usersReset: number }> {
  const result = await prisma.user.updateMany({
    where: { libriOggiUsed: { gt: 0 } },
    data: { libriOggiUsed: 0 },
  });
  return { usersReset: result.count };
}
