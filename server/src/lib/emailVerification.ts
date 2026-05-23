import { createHash, randomBytes } from 'node:crypto';
import { prisma } from './prisma.js';
import { sendMail, isEmailConfigured } from './email.js';

const TOKEN_TTL_HOURS = 48;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function clientBaseUrl(): string {
  return (process.env.CLIENT_URL ?? 'http://localhost:5173').replace(/\/$/, '');
}

export async function issueEmailVerification(userId: string, email: string): Promise<string> {
  const raw = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);

  await prisma.emailVerificationToken.deleteMany({ where: { userId } });
  await prisma.emailVerificationToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  const link = `${clientBaseUrl()}/verifica-email?token=${encodeURIComponent(raw)}`;
  await sendMail({
    to: email,
    subject: 'Conferma la tua email — Libery',
    text: [
      'Ciao!',
      '',
      'Conferma il tuo account Libery aprendo questo link (valido 48 ore):',
      link,
      '',
      'Se non ti sei registrato, ignora questa email.',
    ].join('\n'),
    html: `<p>Ciao!</p><p>Conferma il tuo account Libery:</p><p><a href="${link}">${link}</a></p><p>Il link scade tra 48 ore.</p>`,
  });

  if (!isEmailConfigured()) {
    console.info(`[email-verify] Link dev per ${email}: ${link}`);
  }

  return raw;
}

export async function verifyEmailToken(rawToken: string): Promise<{ ok: true } | { error: string }> {
  const tokenHash = hashToken(rawToken.trim());
  const row = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, emailVerifiedAt: true } } },
  });

  if (!row) {
    return { error: 'Link non valido o già usato' };
  }
  if (row.expiresAt < new Date()) {
    await prisma.emailVerificationToken.delete({ where: { id: row.id } });
    return { error: 'Link scaduto: richiedi una nuova email di verifica' };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { emailVerifiedAt: new Date() },
    }),
    prisma.emailVerificationToken.deleteMany({ where: { userId: row.userId } }),
  ]);

  return { ok: true };
}

export function isEmailVerified(user: { emailVerifiedAt: Date | null }): boolean {
  return user.emailVerifiedAt != null;
}
