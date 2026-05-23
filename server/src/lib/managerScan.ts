import type { UserRole } from '@prisma/client';
import { prisma } from './prisma.js';
import { resolveOperatorPoint } from './pointAccess.js';
import { normalizeIsbn } from './isbn.js';
import { openLibraryCoverByIsbn } from './bookMetadataMerge.js';
import { computeSlots, countActiveReservations, slotsFree } from './bookSlots.js';
import { createNotification } from './notifications.js';
import { triggerAeroplaniniCheck } from './queue.js';
import { parseUserQrPayload, type UserQrAction } from './userQr.js';

export type ManagerScanPreview = {
  action: UserQrAction;
  book: {
    id: string;
    isbn: string;
    title: string;
    author: string | null;
    coverPath: string | null;
  };
  user: {
    id: string;
    displayName: string | null;
    email: string;
  };
  checks: {
    canConfirm: boolean;
    blockReason: string | null;
  };
  reservation: {
    id: string;
    expiresAt: string;
  } | null;
  /** L'utente aveva questo libro in Presi (ritiro non ancora restituito). */
  userHadActiveTake: boolean;
  confirmLabel: string;
};

async function getManagerPoint(managerUserId: string, role: UserRole) {
  return resolveOperatorPoint(managerUserId, role);
}

async function userHadActiveTake(userId: string, bookId: string): Promise<boolean> {
  const [lastTake, lastLeave] = await Promise.all([
    prisma.transaction.findFirst({
      where: { userId, bookId, type: 'take' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    prisma.transaction.findFirst({
      where: { userId, bookId, type: 'leave' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);
  if (!lastTake) return false;
  if (!lastLeave) return true;
  return lastTake.createdAt > lastLeave.createdAt;
}

export async function previewManagerScan(
  managerUserId: string,
  role: UserRole,
  qrRaw: string,
): Promise<ManagerScanPreview | { error: string; status: number }> {
  const parsed = parseUserQrPayload(qrRaw);
  if (!parsed) {
    return { error: 'Inquadra il QR generato dall\'utente nell\'app Libery.', status: 400 };
  }

  const point = await getManagerPoint(managerUserId, role);
  if (!point) {
    return { error: 'Nessun punto assegnato al tuo account', status: 404 };
  }

  const isbn = normalizeIsbn(parsed.isbn);
  if (!isbn) {
    return { error: 'ISBN nel QR non valido', status: 400 };
  }

  const [book, user] = await Promise.all([
    prisma.book.findUnique({ where: { isbn } }),
    prisma.user.findUnique({
      where: { id: parsed.userId },
      select: { id: true, displayName: true, email: true, libriOggiUsed: true, libriExtra: true },
    }),
  ]);

  if (!book) {
    return { error: 'Libro non in catalogo Libery', status: 404 };
  }
  if (!user) {
    return { error: 'Utente non trovato', status: 404 };
  }

  const pointBook = await prisma.pointBook.findUnique({
    where: { pointId_bookId: { pointId: point.id, bookId: book.id } },
    include: {
      reservations: {
        where: {
          userId: parsed.userId,
          status: 'active',
          expiresAt: { gt: new Date() },
        },
        take: 1,
      },
    },
  });

  const hadTake = await userHadActiveTake(parsed.userId, book.id);
  const action = parsed.action;
  let canConfirm = true;
  let blockReason: string | null = null;
  let reservation: { id: string; expiresAt: string } | null = null;

  if (action === 'leave') {
    const confirmLabel = 'Ricevuto';
    return {
      action,
      book: {
        id: book.id,
        isbn: book.isbn,
        title: book.title,
        author: book.author,
        coverPath: book.coverPath ?? openLibraryCoverByIsbn(book.isbn),
      },
      user: {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
      },
      checks: { canConfirm: true, blockReason: null },
      reservation: null,
      userHadActiveTake: hadTake,
      confirmLabel,
    };
  }

  // pickup
  const confirmLabel = 'Consegnato';
  const activeReservations = await countActiveReservations(parsed.userId);
  const slots = computeSlots(user.libriOggiUsed, user.libriExtra);
  const freeSlots = slotsFree(slots.libriTotali, activeReservations);

  const myReservation = pointBook?.reservations[0] ?? null;
  if (myReservation) {
    reservation = {
      id: myReservation.id,
      expiresAt: myReservation.expiresAt.toISOString(),
    };
  }

  const otherReservation = pointBook
    ? await prisma.reservation.findFirst({
        where: {
          pointBookId: pointBook.id,
          status: 'active',
          expiresAt: { gt: new Date() },
          userId: { not: parsed.userId },
        },
      })
    : null;

  if (otherReservation) {
    canConfirm = false;
    blockReason = 'Libro prenotato da un altro lettore.';
  } else if (!pointBook || (!myReservation && pointBook.copies < 1)) {
    canConfirm = false;
    blockReason = 'Nessuna copia disponibile in inventario.';
  } else if (freeSlots < 1) {
    canConfirm = false;
    blockReason =
      activeReservations > 0
        ? 'L\'utente ha esaurito gli slot (prenotazioni attive).'
        : 'L\'utente ha esaurito i libri di oggi.';
  }

  return {
    action,
    book: {
      id: book.id,
      isbn: book.isbn,
      title: book.title,
      author: book.author,
      coverPath: book.coverPath ?? openLibraryCoverByIsbn(book.isbn),
    },
    user: {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
    },
    checks: { canConfirm, blockReason },
    reservation,
    userHadActiveTake: hadTake,
    confirmLabel,
  };
}

export async function confirmManagerScan(
  managerUserId: string,
  role: UserRole,
  action: UserQrAction,
  isbnRaw: string,
  targetUserId: string,
): Promise<{ ok: true; message: string } | { error: string; status: number }> {
  const isbn = normalizeIsbn(isbnRaw);
  if (!isbn) {
    return { error: 'ISBN non valido', status: 400 };
  }

  const point = await getManagerPoint(managerUserId, role);
  if (!point) {
    return { error: 'Punto non valido per scan addetto', status: 400 };
  }

  const preview = await previewManagerScan(managerUserId, role, `${action === 'leave' ? 'L' : 'P'},${isbn},${targetUserId}`);
  if ('error' in preview) {
    return { error: preview.error, status: preview.status };
  }
  if (!preview.checks.canConfirm) {
    return { error: preview.checks.blockReason ?? 'Operazione non consentita', status: 409 };
  }

  const book = await prisma.book.findUnique({ where: { isbn } });
  if (!book) {
    return { error: 'Libro non in catalogo', status: 404 };
  }

  if (action === 'leave') {
    const bookId = book.id;

    const existing = await prisma.pointBook.findUnique({
      where: { pointId_bookId: { pointId: point.id, bookId } },
    });

    await prisma.$transaction([
      existing
        ? prisma.pointBook.update({
            where: { id: existing.id },
            data: { copies: { increment: 1 } },
          })
        : prisma.pointBook.create({
            data: {
              pointId: point.id,
              bookId,
              copies: 1,
              firstAddedAt: new Date(),
            },
          }),
      prisma.transaction.create({
        data: { userId: targetUserId, pointId: point.id, bookId, type: 'leave' },
      }),
      prisma.user.update({
        where: { id: targetUserId },
        data: { libriExtra: { increment: 1 } },
      }),
    ]);

    await createNotification({
      userId: targetUserId,
      type: 'leave_received',
      title: 'Libro consegnato',
      body: `Hai lasciato "${book.title}". Grazie, è ora parte della rete Libery.`,
      data: { pointId: point.id, bookId, pointName: point.name },
    });

    triggerAeroplaniniCheck({
      userId: targetUserId,
      reason: 'leave',
      context: { pointId: point.id, bookId },
    }).catch((err) => console.warn('[queue] aeroplanini-check:', err.message));

    return {
      ok: true,
      message: `"${book.title}" registrato in inventario. L'utente riceverà la notifica.`,
    };
  }

  // pickup
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) {
    return { error: 'Utente non trovato', status: 404 };
  }

  const pointBook = await prisma.pointBook.findUnique({
    where: { pointId_bookId: { pointId: point.id, bookId: book.id } },
  });
  if (!pointBook) {
    return { error: 'Libro non in inventario', status: 404 };
  }

  const reservation = await prisma.reservation.findFirst({
    where: {
      pointBookId: pointBook.id,
      userId: targetUserId,
      status: 'active',
      expiresAt: { gt: new Date() },
    },
  });

  const slots = computeSlots(user.libriOggiUsed, user.libriExtra);
  const userUpdate =
    slots.libriOggi > 0
      ? { libriOggiUsed: { increment: 1 } }
      : { libriExtra: { decrement: 1 } };

  const ops = [];

  if (reservation) {
    ops.push(
      prisma.reservation.update({
        where: { id: reservation.id },
        data: { status: 'completed' },
      }),
    );
  } else {
    ops.push(
      prisma.pointBook.update({
        where: { id: pointBook.id },
        data: { copies: { decrement: 1 } },
      }),
    );
  }

  ops.push(
    prisma.transaction.create({
      data: { userId: targetUserId, pointId: point.id, bookId: book.id, type: 'take' },
    }),
    prisma.user.update({
      where: { id: targetUserId },
      data: userUpdate,
    }),
  );

  await prisma.$transaction(ops);

  await createNotification({
    userId: targetUserId,
    type: 'take_delivered',
    title: 'Libro consegnato',
    body: `Hai preso "${book.title}". Buona lettura!`,
    data: { pointId: point.id, bookId: book.id, pointName: point.name },
  });

  triggerAeroplaniniCheck({
    userId: targetUserId,
    reason: 'take',
    context: { pointId: point.id, bookId: book.id },
  }).catch((err) => console.warn('[queue] aeroplanini-check:', err.message));

  return {
    ok: true,
    message: `"${book.title}" consegnato a ${user.displayName ?? user.email}.`,
  };
}
