import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword } from '../lib/auth.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

const SLOT_DEFAULT_DAILY = 1;

function computeSlots(libriOggiUsed: number, libriExtra: number) {
  const libriOggi = Math.max(0, SLOT_DEFAULT_DAILY - libriOggiUsed);
  return { libriOggi, libriExtra, libriTotali: libriOggi + libriExtra };
}

/**
 * Profilo utente con slot Libri e Aeroplanini.
 */
router.get('/profile', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.sub;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        libriExtra: true,
        libriOggiUsed: true,
        createdAt: true,
        aeroplanini: {
          select: { type: true, earnedAt: true },
          orderBy: { earnedAt: 'desc' },
        },
      },
    });
    if (!user) {
      res.status(404).json({ error: 'Utente non trovato' });
      return;
    }
    res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        libriExtra: user.libriExtra,
        libriOggiUsed: user.libriOggiUsed,
        createdAt: user.createdAt,
        slots: computeSlots(user.libriOggiUsed, user.libriExtra),
        aeroplanini: user.aeroplanini.map((a) => ({
          type: a.type,
          earnedAt: a.earnedAt.toISOString(),
        })),
      },
    });
  } catch (e) {
    next(e);
  }
});

const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(80).nullable().optional(),
  avatarUrl: z.string().url().max(500).nullable().optional(),
});

/**
 * Aggiorna nome visualizzato e/o URL avatar dell'utente.
 */
router.patch('/profile', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.sub;
    const body = updateProfileSchema.parse(req.body);

    const data: Record<string, string | null> = {};
    if (body.displayName !== undefined) data.displayName = body.displayName;
    if (body.avatarUrl !== undefined) data.avatarUrl = body.avatarUrl;

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        libriExtra: true,
        libriOggiUsed: true,
      },
    });
    res.json({ user });
  } catch (e) {
    next(e);
  }
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});

/**
 * Cambia la password dell'utente loggato dopo aver verificato quella corrente.
 */
router.post('/change-password', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.sub;
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'Utente non trovato' });
      return;
    }

    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) {
      res.status(400).json({ error: 'Password attuale non corretta' });
      return;
    }

    if (currentPassword === newPassword) {
      res.status(400).json({ error: 'La nuova password deve essere diversa da quella attuale' });
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(newPassword) },
    });

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/**
 * Solo Aeroplanini posseduti dall'utente.
 */
router.get('/aeroplanini', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.sub;
    const rows = await prisma.userAeroplanino.findMany({
      where: { userId },
      orderBy: { earnedAt: 'desc' },
    });
    res.json({
      aeroplanini: rows.map((row) => ({
        type: row.type,
        earnedAt: row.earnedAt.toISOString(),
      })),
    });
  } catch (e) {
    next(e);
  }
});

/**
 * Zaino: libri Presi (transactions take), Prenotati (reservations attive), Donati (transactions leave).
 */
router.get('/backpack', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.sub;

    const pointSelect = {
      id: true,
      name: true,
      city: true,
      address: true,
    } as const;

    const [taken, donated, reservations] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId, type: 'take' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          book: { select: { id: true, title: true, author: true, isbn: true, coverPath: true } },
          point: { select: pointSelect },
        },
      }),
      prisma.transaction.findMany({
        where: { userId, type: 'leave' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          book: { select: { id: true, title: true, author: true, isbn: true, coverPath: true } },
          point: { select: pointSelect },
        },
      }),
      prisma.reservation.findMany({
        where: { userId, status: 'active', expiresAt: { gt: new Date() } },
        orderBy: { expiresAt: 'asc' },
        include: {
          pointBook: {
            include: {
              book: { select: { id: true, title: true, author: true, isbn: true, coverPath: true } },
              point: { select: pointSelect },
            },
          },
        },
      }),
    ]);

    res.json({
      taken: taken.map((t) => ({
        id: t.id,
        book: t.book,
        point: t.point,
        date: t.createdAt.toISOString(),
      })),
      reserved: reservations.map((r) => ({
        id: r.id,
        expiresAt: r.expiresAt.toISOString(),
        book: r.pointBook.book,
        point: r.pointBook.point,
      })),
      donated: donated.map((t) => ({
        id: t.id,
        book: t.book,
        point: t.point,
        date: t.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    next(e);
  }
});

/**
 * Lista preferiti dell'utente.
 */
router.get('/favorites', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.sub;
    const rows = await prisma.userFavorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        book: {
          select: {
            id: true,
            isbn: true,
            title: true,
            author: true,
            year: true,
            genre: true,
            coverPath: true,
          },
        },
      },
    });
    res.json({
      favorites: rows.map((row) => ({
        bookId: row.bookId,
        favoritedAt: row.createdAt.toISOString(),
        book: row.book,
      })),
    });
  } catch (e) {
    next(e);
  }
});

/**
 * Aggiunge un libro ai preferiti (idempotente).
 */
router.post('/favorites/:bookId', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.sub;
    const bookId = String(req.params.bookId);

    const exists = await prisma.book.findUnique({ where: { id: bookId }, select: { id: true } });
    if (!exists) {
      res.status(404).json({ error: 'Libro non trovato' });
      return;
    }

    await prisma.userFavorite.upsert({
      where: { userId_bookId: { userId, bookId } },
      create: { userId, bookId },
      update: {},
    });

    res.json({ ok: true, favorite: true });
  } catch (e) {
    next(e);
  }
});

/**
 * Rimuove un libro dai preferiti (idempotente).
 */
router.delete('/favorites/:bookId', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.sub;
    const bookId = String(req.params.bookId);

    await prisma.userFavorite
      .delete({ where: { userId_bookId: { userId, bookId } } })
      .catch(() => null);

    res.json({ ok: true, favorite: false });
  } catch (e) {
    next(e);
  }
});

export default router;
