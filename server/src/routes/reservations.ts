import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import {
  computeSlots,
  countActiveReservations,
  getUserSlotSummary,
  slotsFree,
} from '../lib/bookSlots.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { scheduleReservationExpire } from '../lib/queue.js';

const router = Router();

router.use(authenticate);

const RESERVE_HOURS = 24;

const reserveSchema = z.object({
  pointId: z.string().uuid(),
  bookId: z.string().uuid(),
});

router.get('/mine', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.sub;
    const rows = await prisma.reservation.findMany({
      where: { userId, status: 'active', expiresAt: { gt: new Date() } },
      include: {
        pointBook: {
          include: {
            book: { select: { id: true, title: true, isbn: true, coverPath: true } },
            point: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { expiresAt: 'asc' },
    });
    const slotSummary = await getUserSlotSummary(userId);
    res.json({
      reservations: rows.map((r) => ({
        id: r.id,
        expiresAt: r.expiresAt.toISOString(),
        book: r.pointBook.book,
        point: r.pointBook.point,
      })),
      slots: slotSummary ?? {
        libriOggi: 0,
        libriExtra: 0,
        libriTotali: 0,
        activeReservations: 0,
        slotsFree: 0,
      },
    });
  } catch (e) {
    next(e);
  }
});

/**
 * Crea una prenotazione (solo Punti Certificati).
 * - decrementa `copies` di 1 (la copia è riservata)
 * - schedula il job BullMQ di expire dopo 24h (Europe/Rome implicito nel delay)
 */
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { pointId, bookId } = reserveSchema.parse(req.body);
    const userId = req.user!.sub;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { libriOggiUsed: true, libriExtra: true },
    });
    if (!user) {
      res.status(404).json({ error: 'Utente non trovato' });
      return;
    }
    const slots = computeSlots(user.libriOggiUsed, user.libriExtra);
    const activeReservations = await countActiveReservations(userId);
    const free = slotsFree(slots.libriTotali, activeReservations);
    if (slots.libriTotali < 1) {
      res.status(403).json({
        error:
          'Non hai slot libri disponibili: non puoi prenotare se non potresti ritirare il volume in biblioteca.',
      });
      return;
    }
    if (free < 1) {
      res.status(403).json({
        error:
          'Hai già impegnato tutti i tuoi slot con prenotazioni attive. Ritira o annulla una prenotazione.',
      });
      return;
    }

    const point = await prisma.point.findUnique({ where: { id: pointId } });
    if (!point || point.status !== 'approved') {
      res.status(404).json({ error: 'Punto non trovato' });
      return;
    }
    if (point.type === 'corner_free') {
      res.status(400).json({
        error: 'Le prenotazioni sono disponibili solo nei punti certificati',
      });
      return;
    }

    const pointBook = await prisma.pointBook.findUnique({
      where: { pointId_bookId: { pointId, bookId } },
      include: { book: { select: { title: true } } },
    });
    if (!pointBook || pointBook.copies < 1) {
      res.status(400).json({ error: 'Nessuna copia disponibile da prenotare' });
      return;
    }

    const otherActive = await prisma.reservation.findFirst({
      where: {
        pointBookId: pointBook.id,
        status: 'active',
        expiresAt: { gt: new Date() },
        userId: { not: userId },
      },
    });
    if (otherActive) {
      res.status(409).json({ error: 'Questo libro è già prenotato da un altro lettore' });
      return;
    }

    const existingMine = await prisma.reservation.findFirst({
      where: {
        pointBookId: pointBook.id,
        userId,
        status: 'active',
        expiresAt: { gt: new Date() },
      },
    });
    if (existingMine) {
      res.json({
        ok: true,
        message: 'Hai già una prenotazione attiva per questo libro',
        reservation: {
          id: existingMine.id,
          expiresAt: existingMine.expiresAt.toISOString(),
        },
      });
      return;
    }

    const expiresAt = new Date(Date.now() + RESERVE_HOURS * 60 * 60 * 1000);

    const [reservation] = await prisma.$transaction([
      prisma.reservation.create({
        data: {
          userId,
          pointBookId: pointBook.id,
          expiresAt,
        },
      }),
      prisma.pointBook.update({
        where: { id: pointBook.id },
        data: { copies: { decrement: 1 } },
      }),
    ]);

    // Schedulazione expire 24h (fire-and-forget; se Redis è giù logghiamo soltanto)
    scheduleReservationExpire(reservation.id, RESERVE_HOURS * 60 * 60 * 1000).catch(
      (err) => console.warn('[queue] reservation-expire enqueue:', err.message),
    );

    res.status(201).json({
      ok: true,
      message: `"${pointBook.book.title}" prenotato fino a ${expiresAt.toLocaleString('it-IT', {
        dateStyle: 'short',
        timeStyle: 'short',
      })}`,
      reservation: {
        id: reservation.id,
        expiresAt: reservation.expiresAt.toISOString(),
      },
    });
  } catch (e) {
    next(e);
  }
});

/**
 * Cancella la prenotazione e ripristina la copia.
 */
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.sub;
    const reservationId = String(req.params.id);

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
    });
    if (!reservation || reservation.userId !== userId) {
      res.status(404).json({ error: 'Prenotazione non trovata' });
      return;
    }
    if (reservation.status !== 'active') {
      res.status(400).json({ error: 'Prenotazione non più attiva' });
      return;
    }

    await prisma.$transaction([
      prisma.reservation.update({
        where: { id: reservation.id },
        data: { status: 'cancelled' },
      }),
      prisma.pointBook.update({
        where: { id: reservation.pointBookId },
        data: { copies: { increment: 1 } },
      }),
    ]);

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
