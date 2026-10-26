import type { Env } from '../env';

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/** Dev: print the email (password reset links appear in the server log). */
export const consoleMailer: Mailer = {
  async send({ to, subject, text }) {
    console.log(`[mail → ${to}] ${subject}\n${text}`);
  },
};

/** Resend — https://resend.com/docs/api-reference/emails/send-email */
function resend(env: Env): Mailer {
  return {
    async send({ to, subject, text }) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.mailApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env.mailFrom, to, subject, text }),
      });
      if (!res.ok) throw new Error(`Resend failed (${res.status}): ${await res.text()}`);
    },
  };
}

export function createMailer(env: Env): Mailer {
  return env.mailProvider === 'resend' ? resend(env) : consoleMailer;
}
