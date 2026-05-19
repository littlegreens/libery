import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import {
  hashPassword,
  signAccessToken,
  signRefreshToken,
  verifyPassword,
  verifyRefreshToken,
} from '../lib/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2).max(80).optional(),
});

router.post('/register', async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (exists) {
      res.status(409).json({ error: 'Email già registrata' });
      return;
    }

    const user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        passwordHash: await hashPassword(body.password),
        displayName: body.displayName,
        role: 'user',
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        libriExtra: true,
        libriOggiUsed: true,
      },
    });

    const payload = { sub: user.id, email: user.email, role: user.role };
    res.status(201).json({
      user,
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
    });
  } catch (e) {
    next(e);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });

    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      res.status(401).json({ error: 'Credenziali non valide' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: 'Account sospeso' });
      return;
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        libriExtra: user.libriExtra,
        libriOggiUsed: user.libriOggiUsed,
      },
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
    });
  } catch (e) {
    next(e);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = z
      .object({ refreshToken: z.string().min(10) })
      .parse(req.body);

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      res.status(401).json({ error: 'Refresh token non valido o scaduto' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Utente non più valido' });
      return;
    }

    const newPayload = { sub: user.id, email: user.email, role: user.role };
    res.json({
      accessToken: signAccessToken(newPayload),
      refreshToken: signRefreshToken(newPayload),
    });
  } catch (e) {
    next(e);
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        libriExtra: true,
        libriOggiUsed: true,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
      },
    });
    if (!user) {
      res.status(404).json({ error: 'Utente non trovato' });
      return;
    }
    res.json({ user });
  } catch (e) {
    next(e);
  }
});

export default router;
