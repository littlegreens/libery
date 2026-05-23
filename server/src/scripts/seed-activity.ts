/**
 * Seed attività demo: transazioni (scambi) e preferiti per pagina Libri / statistiche.
 * Idempotente: non duplica se già ci sono abbastanza transazioni.
 *
 * npm run seed:activity
 */

import 'dotenv/config';
import { prisma } from '../lib/prisma.js';

const TARGET_TRANSACTIONS = 800;
const TARGET_FAVORITES = 120;
const MONTHS_BACK = 6;

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDateWithinMonths(months: number): Date {
  const now = Date.now();
  const start = now - months * 30 * 24 * 60 * 60 * 1000;
  return new Date(start + Math.random() * (now - start));
}

async function main() {
  const existingTx = await prisma.transaction.count();
  if (existingTx >= TARGET_TRANSACTIONS * 0.9) {
    console.log(`[seed:activity] Già presenti ${existingTx} transazioni — skip (elimina manualmente se vuoi rigenerare).`);
    return;
  }

  const users = await prisma.user.findMany({
    where: { isActive: true, role: { in: ['user', 'point_manager', 'point_staff'] } },
    select: { id: true },
  });
  if (users.length === 0) {
    console.error('[seed:activity] Nessun utente attivo. Esegui seed:users prima.');
    process.exit(1);
  }

  const inventory = await prisma.pointBook.findMany({
    where: {
      copies: { gt: 0 },
      status: 'active',
      point: { status: 'approved' },
    },
    select: { pointId: true, bookId: true },
  });
  if (inventory.length < 10) {
    console.error('[seed:activity] Inventario insufficiente. Esegui seed:lazio prima.');
    process.exit(1);
  }

  const bookIds = [...new Set(inventory.map((r) => r.bookId))];
  const hotBooks = shuffleCopy(bookIds).slice(0, Math.min(25, bookIds.length));
  const warmBooks = shuffleCopy(bookIds.filter((id) => !hotBooks.includes(id))).slice(0, 40);

  const invByBook = new Map<string, Array<{ pointId: string; bookId: string }>>();
  for (const row of inventory) {
    const list = invByBook.get(row.bookId) ?? [];
    list.push(row);
    invByBook.set(row.bookId, list);
  }

  console.log(`[seed:activity] Creazione ~${TARGET_TRANSACTIONS} transazioni…`);

  const txBatch: Array<{
    userId: string;
    pointId: string;
    bookId: string;
    type: 'take' | 'leave';
    createdAt: Date;
  }> = [];

  for (let i = 0; i < TARGET_TRANSACTIONS; i++) {
    const bookId =
      Math.random() < 0.6 && hotBooks.length > 0
        ? hotBooks[randomInt(0, hotBooks.length - 1)]
        : (warmBooks.length > 0 ? warmBooks : bookIds)[randomInt(0, (warmBooks.length || bookIds.length) - 1)];

    const slots = invByBook.get(bookId) ?? inventory;
    const slot = slots[randomInt(0, slots.length - 1)];
    const user = users[randomInt(0, users.length - 1)];
    const type = Math.random() < 0.52 ? 'take' : 'leave';

    txBatch.push({
      userId: user.id,
      pointId: slot.pointId,
      bookId: slot.bookId,
      type,
      createdAt: randomDateWithinMonths(MONTHS_BACK),
    });
  }

  const CHUNK = 100;
  for (let i = 0; i < txBatch.length; i += CHUNK) {
    await prisma.transaction.createMany({ data: txBatch.slice(i, i + CHUNK) });
  }

  console.log(`[seed:activity] Transazioni create: ${txBatch.length}`);

  const existingFav = await prisma.userFavorite.count();
  const favToCreate = Math.max(0, TARGET_FAVORITES - existingFav);
  if (favToCreate === 0) {
    console.log('[seed:activity] Preferiti già sufficienti.');
  } else {
    const favSet = new Set<string>();
    const favRows: { userId: string; bookId: string }[] = [];
    const favPool = [...hotBooks, ...warmBooks.slice(0, 15)];

    while (favRows.length < favToCreate && favRows.length < users.length * favPool.length) {
      const user = users[randomInt(0, users.length - 1)];
      const bookId = favPool[randomInt(0, favPool.length - 1)];
      const key = `${user.id}:${bookId}`;
      if (favSet.has(key)) continue;
      favSet.add(key);
      favRows.push({ userId: user.id, bookId });
    }

    if (favRows.length > 0) {
      await prisma.userFavorite.createMany({ data: favRows, skipDuplicates: true });
    }
    console.log(`[seed:activity] Preferiti aggiunti: ${favRows.length}`);
  }

  const top = await prisma.transaction.groupBy({
    by: ['bookId'],
    _count: { _all: true },
    orderBy: { _count: { bookId: 'desc' } },
    take: 5,
  });
  console.log('[seed:activity] Top ISBN per transazioni:', top.length);
  console.log('[seed:activity] Fatto.');
}

function shuffleCopy<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
