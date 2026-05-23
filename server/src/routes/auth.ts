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
import {
  issueEmailVerification,
  isEmailVerified,
  verifyEmailToken,
} from '../lib/emailVerification.js';
import { pointRequestBodySchema, pointRequestToDb } from '../lib/pointRequestSchema.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2).max(80).optional(),
  pointRequest: pointRequestBodySchema.optional(),
});

const userSelect = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  libriExtra: true,
  libriOggiUsed: true,
  emailVerifiedAt: true,
} as const;

function authResponse(user: {
  id: string;
  email: string;
  displayName: string | null;
  role: import('@prisma/client').UserRole;
  libriExtra: number;
  libriOggiUsed: number;
  emailVerifiedAt: Date | null;
  avatarUrl?: string | null;
}) {
  const payload = { sub: user.id, email: user.email, role: user.role };
  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      libriExtra: user.libriExtra,
      libriOggiUsed: user.libriOggiUsed,
      emailVerified: isEmailVerified(user),
    },
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

router.post('/register', async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const email = body.email.toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      res.status(409).json({ error: 'Email già registrata' });
      return;
    }

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(body.password),
        displayName: body.displayName,
        role: 'user',
        emailVerifiedAt: null,
      },
      select: userSelect,
    });

    if (body.pointRequest) {
      const pr = pointRequestToDb(body.pointRequest);
      await prisma.pointRequest.create({
        data: {
          requesterId: user.id,
          pointType: pr.pointType,
          name: pr.name,
          address: pr.address,
          city: pr.city,
          latitude: pr.latitude,
          longitude: pr.longitude,
          contactEmail: email,
          contactPhone: pr.contactPhone,
          notes: pr.notes,
        },
      });
    }

    await issueEmailVerification(user.id, user.email);

    const pointNote = body.pointRequest
      ? ' La proposta di luogo è stata registrata: la esamineremo dopo la verifica email.'
      : '';

    res.status(201).json({
      needsEmailVerification: true,
      email: user.email,
      message: `Ti abbiamo inviato un'email di conferma. Apri il link per attivare l'account, poi accedi.${pointNote}`,
      pointRequestSubmitted: Boolean(body.pointRequest),
    });
  } catch (e) {
    next(e);
  }
});

router.post('/verify-email', async (req, res, next) => {
  try {
    const { token } = z.object({ token: z.string().min(16) }).parse(req.body);
    const result = await verifyEmailToken(token);
    if ('error' in result) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ ok: true, message: 'Email verificata. Ora puoi accedere.' });
  } catch (e) {
    next(e);
  }
});

router.post('/resend-verification', async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, emailVerifiedAt: true },
    });
    if (!user || isEmailVerified(user)) {
      res.json({ ok: true, message: 'Se l\'account esiste e non è verificato, riceverai una nuova email.' });
      return;
    }
    await issueEmailVerification(user.id, user.email);
    res.json({ ok: true, message: 'Email di verifica inviata.' });
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

    if (!isEmailVerified(user)) {
      res.status(403).json({
        error: 'Conferma la tua email prima di accedere',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
      });
      return;
    }

    res.json(
      authResponse({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        libriExtra: user.libriExtra,
        libriOggiUsed: user.libriOggiUsed,
        emailVerifiedAt: user.emailVerifiedAt,
        avatarUrl: user.avatarUrl,
      }),
    );
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
    if (!user || !user.isActive || !isEmailVerified(user)) {
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
        ...userSelect,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
      },
    });
    if (!user) {
      res.status(404).json({ error: 'Utente non trovato' });
      return;
    }
    res.json({
      user: {
        ...user,
        emailVerified: isEmailVerified(user),
      },
    });
  } catch (e) {
    next(e);
  }
});

export default router;
