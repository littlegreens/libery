import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken, type JwtPayload } from '../lib/auth.js';

export type AuthRequest = Request & { user?: JwtPayload };

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token mancante' });
    return;
  }

  try {
    req.user = verifyAccessToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ error: 'Token non valido o scaduto' });
  }
}

/**
 * Auth permissiva: se il token è valido, popola req.user; altrimenti procede comunque.
 * Utile per endpoint pubblici che vogliono arricchire la risposta per utenti loggati
 * (es. isFavorite sui libri).
 */
export function optionalAuthenticate(req: AuthRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next();
    return;
  }
  try {
    req.user = verifyAccessToken(header.slice(7));
  } catch {
    // token invalido: trattiamo come anonimo
  }
  next();
}

export function requireRole(...roles: JwtPayload['role'][]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Non autenticato' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Permesso negato' });
      return;
    }
    next();
  };
}
