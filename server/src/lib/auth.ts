import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { UserRole } from '@prisma/client';

export type JwtPayload = {
  sub: string;
  email: string;
  role: UserRole;
};

const accessSecret = process.env.JWT_ACCESS_SECRET ?? 'dev-access';
const refreshSecret = process.env.JWT_REFRESH_SECRET ?? 'dev-refresh';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(payload: JwtPayload): string {
  const expiresIn = (process.env.JWT_ACCESS_EXPIRES ?? '15m') as SignOptions['expiresIn'];
  return jwt.sign(payload, accessSecret, { expiresIn });
}

export function signRefreshToken(payload: JwtPayload): string {
  const expiresIn = (process.env.JWT_REFRESH_EXPIRES ?? '7d') as SignOptions['expiresIn'];
  return jwt.sign(payload, refreshSecret, { expiresIn });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, accessSecret) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, refreshSecret) as JwtPayload;
}
