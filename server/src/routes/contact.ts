import { Router } from 'express';
import { z } from 'zod';
import { isEmailConfigured, sendMail } from '../lib/email.js';

const router = Router();

const bodySchema = z.object({
  name: z.string().trim().min(1, 'Nome obbligatorio').max(120),
  email: z.string().trim().email('Email non valida').max(254),
  message: z.string().trim().min(1, 'Messaggio obbligatorio').max(5000),
});

function contactInbox(): string {
  return (
    process.env.CONTACT_EMAIL?.trim() ||
    process.env.ADMIN_EMAIL?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    'gab.verdini@gmail.com'
  );
}

/** Form «Scrivici» dalla home (pubblico, senza login). */
router.post('/', async (req, res, next) => {
  try {
    const { name, email, message } = bodySchema.parse(req.body);

    if (!isEmailConfigured()) {
      res.status(503).json({ error: 'Invio email temporaneamente non disponibile' });
      return;
    }

    const to = contactInbox();
    const subject = `[Libery] Messaggio da ${name}`;
    const text = [`Nome: ${name}`, `Email: ${email}`, '', message].join('\n');

    const { sent } = await sendMail({
      to,
      subject,
      text,
      replyTo: email,
    });

    if (!sent) {
      res.status(503).json({ error: 'Invio email temporaneamente non disponibile' });
      return;
    }

    res.json({ ok: true, message: 'Messaggio inviato' });
  } catch (e) {
    next(e);
  }
});

export default router;
