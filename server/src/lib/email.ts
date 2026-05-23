import nodemailer from 'nodemailer';

const smtpUser = process.env.SMTP_USER ?? process.env.SMTP_FROM ?? 'gab.verdini@gmail.com';
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM ?? smtpUser;

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!smtpPass?.trim()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: smtpUser, pass: smtpPass },
    });
  }
  return transporter;
}

export function isEmailConfigured(): boolean {
  return Boolean(smtpPass?.trim());
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}): Promise<{ sent: boolean; previewUrl?: string }> {
  const transport = getTransporter();
  if (!transport) {
    console.warn('[email] SMTP_PASS non configurato — email non inviata:', opts.subject, '→', opts.to);
    console.warn('[email]', opts.text);
    return { sent: false };
  }

  const info = await transport.sendMail({
    from: `"Libery" <${smtpFrom}>`,
    to: opts.to,
    replyTo: opts.replyTo,
    subject: opts.subject,
    text: opts.text,
    html: opts.html ?? opts.text.replace(/\n/g, '<br>'),
  });

  return { sent: true, previewUrl: nodemailer.getTestMessageUrl(info) || undefined };
}
