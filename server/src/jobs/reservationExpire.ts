import { prisma } from '../lib/prisma.js';
import { createNotification } from '../lib/notifications.js';

export type ReservationExpireResult =
  | { status: 'expired'; reservationId: string }
  | { status: 'noop'; reason: string };

/**
 * Scade una prenotazione attiva e ripristina la copia.
 * Idempotente: se la prenotazione è già completata o scaduta, non fa nulla.
 */
export async function runReservationExpire(
  reservationId: string,
): Promise<ReservationExpireResult> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      pointBook: { include: { book: true, point: true } },
    },
  });

  if (!reservation) return { status: 'noop', reason: 'not_found' };
  if (reservation.status !== 'active') {
    return { status: 'noop', reason: `already_${reservation.status}` };
  }

  await prisma.$transaction([
    prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: 'expired' },
    }),
    prisma.pointBook.update({
      where: { id: reservation.pointBookId },
      data: { copies: { increment: 1 } },
    }),
  ]);

  await createNotification({
    userId: reservation.userId,
    type: 'reservation_expired',
    title: 'Prenotazione scaduta',
    body: `La tua prenotazione di "${reservation.pointBook.book.title}" è scaduta. La copia è tornata disponibile.`,
    data: {
      bookId: reservation.pointBook.bookId,
      pointId: reservation.pointBook.pointId,
      reservationId: reservation.id,
    },
  });

  return { status: 'expired', reservationId: reservation.id };
}
