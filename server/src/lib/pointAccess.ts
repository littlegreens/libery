import type { Point, UserRole } from '@prisma/client';
import { prisma } from './prisma.js';

/** Punto su cui l'utente può operare come responsabile o addetto (o qualsiasi approvato se admin). */
export async function resolveOperatorPoint(
  userId: string,
  role: UserRole,
): Promise<Point | null> {
  if (role === 'admin') {
    return prisma.point.findFirst({
      where: { status: 'approved' },
      orderBy: { name: 'asc' },
    });
  }

  if (role === 'point_manager') {
    return prisma.point.findFirst({
      where: { managerId: userId, status: 'approved' },
      orderBy: { name: 'asc' },
    });
  }

  if (role === 'point_staff') {
    const row = await prisma.pointStaff.findFirst({
      where: { userId },
      include: { point: true },
      orderBy: { createdAt: 'asc' },
    });
    return row?.point ?? null;
  }

  return null;
}

export function canOperatePoint(role: UserRole): boolean {
  return role === 'admin' || role === 'point_manager' || role === 'point_staff';
}
