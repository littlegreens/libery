import { prisma } from '../lib/prisma.js';
import { createNotification } from '../lib/notifications.js';
import type { AeroplaniniTrigger } from '../lib/queue.js';

export type AeroplaninoType =
  | 'primo_volo'
  | 'esploratore'
  | 'custode'
  | 'grande_donatore'
  | 'viaggiatore';

const AEROPLANINI_LABELS: Record<AeroplaninoType, string> = {
  primo_volo: 'Primo Volo',
  esploratore: 'Esploratore',
  custode: 'Custode',
  grande_donatore: 'Grande Donatore',
  viaggiatore: 'Viaggiatore',
};

/**
 * Regole achievement v1 (espandibili).
 * Ogni regola è valutata in modo idempotente: se già presente, non viene riassegnata.
 */
export async function runAeroplaniniCheck(trigger: AeroplaniniTrigger): Promise<AeroplaninoType[]> {
  const { userId } = trigger;
  const newlyEarned: AeroplaninoType[] = [];

  const owned = new Set(
    (
      await prisma.userAeroplanino.findMany({
        where: { userId },
        select: { type: true },
      })
    ).map((row) => row.type as AeroplaninoType),
  );

  const candidates: AeroplaninoType[] = [
    'primo_volo',
    'esploratore',
    'custode',
    'grande_donatore',
    'viaggiatore',
  ];

  for (const type of candidates) {
    if (owned.has(type)) continue;
    if (await evaluate(type, trigger)) {
      try {
        await prisma.userAeroplanino.create({ data: { userId, type } });
        newlyEarned.push(type);
        await createNotification({
          userId,
          type: 'aeroplanino_earned',
          title: `Hai sbloccato "${AEROPLANINI_LABELS[type]}"!`,
          body: 'Un nuovo aeroplanino è atterrato sul tuo profilo.',
          data: { aeroplanino: type },
        });
      } catch {
        // unique violation: race; va bene, ignoriamo
      }
    }
  }

  return newlyEarned;
}

async function evaluate(
  type: AeroplaninoType,
  trigger: AeroplaniniTrigger,
): Promise<boolean> {
  const { userId } = trigger;

  switch (type) {
    case 'primo_volo': {
      const leaves = await prisma.transaction.count({
        where: { userId, type: 'leave' },
      });
      return leaves >= 1;
    }

    case 'grande_donatore': {
      const leaves = await prisma.transaction.count({
        where: { userId, type: 'leave' },
      });
      return leaves >= 10;
    }

    case 'esploratore': {
      const distinctPoints = await prisma.transaction.findMany({
        where: { userId },
        distinct: ['pointId'],
        select: { pointId: true },
      });
      return distinctPoints.length >= 5;
    }

    case 'viaggiatore': {
      const cities = await prisma.transaction.findMany({
        where: { userId, type: 'leave' },
        select: { point: { select: { city: true } } },
      });
      const unique = new Set(
        cities.map((row) => row.point.city?.trim().toLowerCase()).filter(Boolean),
      );
      return unique.size >= 3;
    }

    case 'custode': {
      const reports = await prisma.report.count({
        where: { userId, type: 'missing' },
      });
      return reports >= 10;
    }
  }
}
