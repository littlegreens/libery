import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { hashPassword } from '../../lib/auth.js';
import type { AuthRequest } from '../../middleware/auth.js';

const router = Router();

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2).max(80).optional(),
  role: z.enum(['user', 'point_staff', 'point_manager']).default('user'),
});

const listQuerySchema = z.object({
  q: z.string().optional(),
  role: z.enum(['user', 'point_staff', 'point_manager', 'admin']).optional(),
  active: z.enum(['true', 'false']).optional(),
});

const roleUpdateSchema = z.object({
  role: z.enum(['user', 'point_staff', 'point_manager', 'admin']),
});

router.get('/', async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const users = await prisma.user.findMany({
      where: {
        ...(query.role ? { role: query.role } : {}),
        ...(query.active === 'true' ? { isActive: true } : {}),
        ...(query.active === 'false' ? { isActive: false } : {}),
        ...(query.q
          ? {
              OR: [
                { email: { contains: query.q, mode: 'insensitive' } },
                { displayName: { contains: query.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        libriExtra: true,
        libriOggiUsed: true,
        isActive: true,
        emailVerifiedAt: true,
        createdAt: true,
        managedPoints: { select: { id: true, name: true, status: true } },
        pointStaffAt: {
          select: { point: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ users, total: users.length });
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = createUserSchema.parse(req.body);
    const email = body.email.toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      res.status(409).json({ error: 'Email già in uso' });
      return;
    }

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(body.password),
        displayName: body.displayName,
        role: body.role,
        emailVerifiedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
    res.status(201).json({ user });
  } catch (e) {
    next(e);
  }
});

router.put('/:id/role', async (req: AuthRequest, res, next) => {
  try {
    const body = roleUpdateSchema.parse(req.body);
    const userId = String(req.params.id);

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, managedPoints: { select: { id: true } } },
    });
    if (!target) {
      res.status(404).json({ error: 'Utente non trovato' });
      return;
    }

    if (userId === req.user!.sub && target.role === 'admin' && body.role !== 'admin') {
      res.status(400).json({ error: 'Non puoi rimuovere il tuo ruolo admin' });
      return;
    }

    if (body.role === 'admin' && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Solo un admin può promuovere altri admin' });
      return;
    }

    if (body.role === 'point_manager' && target.managedPoints.length === 0) {
      res.status(400).json({
        error: 'Assegna prima un punto come responsabile (approva richiesta o crea punto)',
      });
      return;
    }

    if (body.role === 'user' && target.role === 'point_staff') {
      await prisma.pointStaff.deleteMany({ where: { userId } });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role: body.role },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        isActive: true,
      },
    });
    res.json({ user });
  } catch (e) {
    next(e);
  }
});

router.put('/:id/status', async (req: AuthRequest, res, next) => {
  try {
    const body = z
      .object({ isActive: z.boolean() })
      .parse(req.body);

    if (String(req.params.id) === req.user!.sub) {
      res.status(400).json({ error: 'Non puoi sospendere il tuo account' });
      return;
    }

    const user = await prisma.user.update({
      where: { id: String(req.params.id) },
      data: { isActive: body.isActive },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        isActive: true,
      },
    });
    res.json({ user });
  } catch (e) {
    next(e);
  }
});

export default router;
