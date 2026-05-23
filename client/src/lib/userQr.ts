/** Payload QR utente per ritiro/consegna (BRAIN §8.2). */

export function buildPickupQrPayload(isbn: string, userId: string): string {
  const digits = isbn.replace(/\D/g, '');
  return `P,${digits},${userId}`;
}

export function buildLeaveQrPayload(isbn: string, userId: string): string {
  const digits = isbn.replace(/\D/g, '');
  return `L,${digits},${userId}`;
}

export type UserQrAction = 'leave' | 'pickup';

/** Interpreta `L,ISBN,user_id` o `P,ISBN,user_id`. */
export function parseUserQrPayload(text: string): { action: UserQrAction; isbn: string; userId: string } | null {
  const m = text.trim().match(/^([LP]),(\d{10,13}),([0-9a-f-]{36})$/i);
  if (!m) return null;
  return {
    action: m[1]!.toUpperCase() === 'L' ? 'leave' : 'pickup',
    isbn: m[2]!,
    userId: m[3]!,
  };
}

export function pickupQrImageUrl(payload: string, size = 240): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(payload)}&margin=8`;
}
