import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

const sinceSchema = z.object({
  since: z.string().datetime().optional(),
  unreadOnly: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

/**
 * Lista notifiche dell'utente.
 * Polling consigliato 2-3s sulle schermate "QR utente" e "SCAN responsabile".
 */
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { since, unreadOnly, limit } = sinceSchema.parse(req.query);
    const userId = req.user!.sub;

    const where = {
      userId,
      ...(since ? { createdAt: { gt: new Date(since) } } : {}),
      ...(unreadOnly === 'true' ? { readAt: null } : {}),
    };

    const rows = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit ?? 20,
    });

    res.json({
      notifications: rows.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        data: n.data,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    next(e);
  }
});

/**
 * Marca una notifica come letta.
 */
router.post('/:id/read', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.sub;
    const id = String(req.params.id);

    const notif = await prisma.notification.findUnique({ where: { id } });
    if (!notif || notif.userId !== userId) {
      res.status(404).json({ error: 'Notifica non trovata' });
      return;
    }
    if (notif.readAt) {
      res.json({ ok: true, alreadyRead: true });
      return;
    }
    await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
