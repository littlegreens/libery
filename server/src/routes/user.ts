import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword } from '../lib/auth.js';
import {
  avatarPublicPath,
  ensureAvatarDir,
  extFromMime,
  removeOtherAvatarFiles,
} from '../lib/uploads.js';
import { computeSlots, getUserSlotSummary } from '../lib/bookSlots.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { isEmailVerified } from '../lib/emailVerification.js';

const router = Router();

router.use(authenticate);

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
        emailVerifiedAt: true,
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
        emailVerified: isEmailVerified(user),
        slots:
          (await getUserSlotSummary(userId)) ??
          {
            ...computeSlots(user.libriOggiUsed, user.libriExtra),
            activeReservations: 0,
            slotsFree: 0,
          },
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

/** Slot liberi (oggi + extra − prenotazioni attive). */
router.get('/slots', async (req: AuthRequest, res, next) => {
  try {
    const summary = await getUserSlotSummary(req.user!.sub);
    if (!summary) {
      res.status(404).json({ error: 'Utente non trovato' });
      return;
    }
    res.json({ slots: summary });
  } catch (e) {
    next(e);
  }
});

const avatarUrlSchema = z.union([
  z.string().url().max(500),
  z.string().regex(/^\/api\/uploads\/avatars\/[a-zA-Z0-9_-]+\.(jpe?g|png|webp)$/i),
]);

const updateProfileSchema = z
  .object({
    displayName: z.string().min(2).max(80).nullable().optional(),
    avatarUrl: avatarUrlSchema.nullable().optional(),
    currentPassword: z.string().min(1).optional(),
    newPassword: z.string().min(8).max(200).optional(),
  })
  .superRefine((body, ctx) => {
    const hasNew = Boolean(body.newPassword?.length);
    const hasCurrent = Boolean(body.currentPassword?.length);
    if (hasNew !== hasCurrent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Per cambiare password servono password attuale e nuova',
        path: ['newPassword'],
      });
    }
  });

const AVATAR_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      ensureAvatarDir()
        .then((dir) => cb(null, dir))
        .catch((err) => cb(err as Error, ''));
    },
    filename: (req, file, cb) => {
      const userId = (req as AuthRequest).user!.sub;
      cb(null, `${userId}${extFromMime(file.mimetype)}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (AVATAR_MIMES.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error('Formato immagine non supportato (usa JPG, PNG o WebP)'));
  },
});

/**
 * Aggiorna nome visualizzato e/o URL avatar dell'utente.
 */
router.post('/avatar', avatarUpload.single('avatar'), async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.sub;
    if (!req.file) {
      res.status(400).json({ error: 'Nessuna immagine inviata' });
      return;
    }

    const ext = extFromMime(req.file.mimetype);
    await removeOtherAvatarFiles(userId, ext);
    const avatarUrl = avatarPublicPath(userId, ext);

    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
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

    res.json({ user, avatarUrl });
  } catch (e) {
    next(e);
  }
});

router.patch('/profile', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.sub;
    const body = updateProfileSchema.parse(req.body);

    const data: {
      displayName?: string | null;
      avatarUrl?: string | null;
      passwordHash?: string;
    } = {};
    if (body.displayName !== undefined) data.displayName = body.displayName;
    if (body.avatarUrl !== undefined) data.avatarUrl = body.avatarUrl;

    if (body.newPassword) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        res.status(404).json({ error: 'Utente non trovato' });
        return;
      }
      const ok = await verifyPassword(body.currentPassword!, user.passwordHash);
      if (!ok) {
        res.status(400).json({ error: 'Password attuale non corretta' });
        return;
      }
      if (body.currentPassword === body.newPassword) {
        res.status(400).json({ error: 'La nuova password deve essere diversa da quella attuale' });
        return;
      }
      data.passwordHash = await hashPassword(body.newPassword);
    }

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

    const [allTaken, donated, reservations] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId, type: 'take' },
        orderBy: { createdAt: 'desc' },
        take: 100,
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

    const maxLeaveAtByBook = new Map<string, number>();
    for (const l of donated) {
      const t = l.createdAt.getTime();
      maxLeaveAtByBook.set(l.bookId, Math.max(maxLeaveAtByBook.get(l.bookId) ?? 0, t));
    }
    const taken = allTaken.filter(
      (t) => t.createdAt.getTime() > (maxLeaveAtByBook.get(t.bookId) ?? 0),
    );

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
