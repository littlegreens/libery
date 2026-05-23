/** Payload QR utente stateless (BRAIN §8.2). */

export type UserQrAction = 'leave' | 'pickup';

export function parseUserQrPayload(
  text: string,
): { action: UserQrAction; isbn: string; userId: string } | null {
  const m = text.trim().match(/^([LP]),(\d{10,13}),([0-9a-f-]{36})$/i);
  if (!m) return null;
  return {
    action: m[1]!.toUpperCase() === 'L' ? 'leave' : 'pickup',
    isbn: m[2]!,
    userId: m[3]!,
  };
}
