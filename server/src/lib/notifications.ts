import { prisma } from './prisma.js';

export type NotificationType =
  | 'leave_received'
  | 'take_delivered'
  | 'reservation_expired'
  | 'aeroplanino_earned'
  | 'generic';

export type NotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  data?: Record<string, unknown> | null;
};

/**
 * Crea una notifica persistente per un utente.
 * Il client la riceve via polling su /api/notifications.
 */
export async function createNotification(input: NotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      data: (input.data as object | null) ?? undefined,
    },
  });
}
