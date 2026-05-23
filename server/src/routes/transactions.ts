import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { normalizeIsbn } from '../lib/isbn.js';
import { resolveBookByIsbn } from '../services/bookCatalog.js';
import { computeSlots, countActiveReservations, slotsFree } from '../lib/bookSlots.js';
import { triggerAeroplaniniCheck } from '../lib/queue.js';

const router = Router();

router.use(authenticate);

const bodySchema = z.object({
  pointId: z.string().uuid(),
  isbn: z.string().min(10).max(20),
});

/**
 * Prendi un libro da Corner Free (no controllo addetto).
 * Per i Punti Certificati l'azione passa dall'addetto via scan QR.
 */
router.post('/take', async (req: AuthRequest, res, next) => {
  try {
    const { pointId, isbn: rawIsbn } = bodySchema.parse(req.body);
    const isbn = normalizeIsbn(rawIsbn);
    if (!isbn) {
      res.status(400).json({ error: 'ISBN non valido' });
      return;
    }
    const userId = req.user!.sub;

    const book = await prisma.book.findUnique({ where: { isbn } });
    if (!book) {
      res.status(404).json({ error: 'Libro non in catalogo' });
      return;
    }

    const point = await prisma.point.findUnique({ where: { id: pointId } });
    if (!point || point.status !== 'approved') {
      res.status(404).json({ error: 'Punto non valido' });
      return;
    }

    if (point.type !== 'corner_free') {
      res.status(400).json({
        error:
          'Nei Punti Certificati il libro va richiesto allo scan dell\'addetto. Genera il QR dalla scheda del libro.',
      });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'Utente non trovato' });
      return;
    }
    const slots = computeSlots(user.libriOggiUsed, user.libriExtra);
    const activeReservations = await countActiveReservations(userId);
    const free = slotsFree(slots.libriTotali, activeReservations);
    if (free < 1) {
      res.status(403).json({
        error:
          activeReservations > 0
            ? 'Hai già impegnato tutti i tuoi slot con prenotazioni attive. Ritira o annulla una prenotazione.'
            : 'Hai esaurito i libri di oggi. Torna domani o dona un libro per averne uno extra.',
      });
      return;
    }

    const pointBook = await prisma.pointBook.findUnique({
      where: { pointId_bookId: { pointId, bookId: book.id } },
    });
    if (!pointBook || pointBook.copies < 1) {
      res.status(409).json({ error: 'Libro non più disponibile in questo corner' });
      return;
    }

    // Consuma prima libri_oggi, poi libri_extra
    const userUpdate =
      slots.libriOggi > 0
        ? { libriOggiUsed: { increment: 1 } }
        : { libriExtra: { decrement: 1 } };

    const [, , updatedUser] = await prisma.$transaction([
      prisma.pointBook.update({
        where: { id: pointBook.id },
        data: { copies: { decrement: 1 } },
      }),
      prisma.transaction.create({
        data: { userId, pointId, bookId: book.id, type: 'take' },
      }),
      prisma.user.update({
        where: { id: userId },
        data: userUpdate,
      }),
    ]);

    triggerAeroplaniniCheck({
      userId,
      reason: 'take',
      context: { pointId, bookId: book.id },
    }).catch((err) => console.warn('[queue] aeroplanini-check enqueue:', err.message));

    res.json({
      ok: true,
      message: `Hai preso "${book.title}" dal ${point.name}. Buona lettura!`,
      book: { id: book.id, title: book.title, author: book.author },
      point: { id: point.id, name: point.name },
      slots: computeSlots(updatedUser.libriOggiUsed, updatedUser.libriExtra),
    });
  } catch (e) {
    next(e);
  }
});

/**
 * Lascia un libro in un Corner Free (l'utente conferma in app dopo aver agganciato il corner).
 * Per i Punti Certificati l'azione passa dall'addetto via scan QR.
 */
router.post('/leave', async (req: AuthRequest, res, next) => {
  try {
    const { pointId, isbn: rawIsbn } = bodySchema.parse(req.body);
    const isbn = normalizeIsbn(rawIsbn);
    if (!isbn) {
      res.status(400).json({ error: 'ISBN non valido' });
      return;
    }
    const userId = req.user!.sub;

    const resolved = await resolveBookByIsbn(isbn);
    if (!resolved.ok) {
      res.status(404).json({
        error: "Libro non riconosciuto. Controlla l'ISBN o riprova.",
        isbn,
      });
      return;
    }
    const book = resolved.book;

    const point = await prisma.point.findUnique({ where: { id: pointId } });
    if (!point || point.status !== 'approved') {
      res.status(404).json({ error: 'Punto non valido' });
      return;
    }

    if (point.type !== 'corner_free') {
      res.status(400).json({
        error:
          "Nei Punti Certificati il libro va consegnato all'addetto: genera il QR dalla scheda del libro e fallo scansionare.",
      });
      return;
    }

    const existing = await prisma.pointBook.findUnique({
      where: { pointId_bookId: { pointId, bookId: book.id } },
    });

    const [, , updatedUser] = await prisma.$transaction([
      existing
        ? prisma.pointBook.update({
            where: { id: existing.id },
            data: { copies: { increment: 1 } },
          })
        : prisma.pointBook.create({
            data: {
              pointId,
              bookId: book.id,
              copies: 1,
              firstAddedAt: new Date(),
            },
          }),
      prisma.transaction.create({
        data: { userId, pointId, bookId: book.id, type: 'leave' },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { libriExtra: { increment: 1 } },
      }),
    ]);

    triggerAeroplaniniCheck({
      userId,
      reason: 'leave',
      context: { pointId, bookId: book.id },
    }).catch((err) => console.warn('[queue] aeroplanini-check enqueue:', err.message));

    res.json({
      ok: true,
      message: `Hai lasciato "${book.title}" al ${point.name}. È ora disponibile per il prossimo lettore.`,
      book: { id: book.id, title: book.title, author: book.author },
      point: { id: point.id, name: point.name },
      slots: computeSlots(updatedUser.libriOggiUsed, updatedUser.libriExtra),
    });
  } catch (e) {
    next(e);
  }
});

export default router;
