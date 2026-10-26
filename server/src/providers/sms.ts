import type { Env } from '../env';

export interface SmsSender {
  send(to: string, message: string): Promise<void>;
}

/** Dev: print the message (OTP codes appear in the server log). */
export const consoleSms: SmsSender = {
  async send(to, message) {
    console.log(`[sms → ${to}] ${message}`);
  },
};

/** Arkesel SMS v2 — https://developers.arkesel.com */
function arkesel(env: Env): SmsSender {
  return {
    async send(to, message) {
      const res = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
        method: 'POST',
        headers: { 'api-key': env.smsApiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: env.smsSenderId,
          message,
          recipients: [to.replace(/^\+/, '')],
        }),
      });
      if (!res.ok) throw new Error(`Arkesel SMS failed (${res.status}): ${await res.text()}`);
    },
  };
}

/** Hubtel quick-send — https://developers.hubtel.com */
function hubtel(env: Env): SmsSender {
  return {
    async send(to, message) {
      const url = new URL('https://smsc.hubtel.com/v1/messages/send');
      url.search = new URLSearchParams({
        clientid: env.smsApiKey,
        clientsecret: env.smsApiSecret,
        from: env.smsSenderId,
        to: to.replace(/^\+/, ''),
        content: message,
      }).toString();
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Hubtel SMS failed (${res.status}): ${await res.text()}`);
    },
  };
}

export function createSmsSender(env: Env): SmsSender {
  switch (env.smsProvider) {
    case 'arkesel':
      return arkesel(env);
    case 'hubtel':
      return hubtel(env);
    default:
      return consoleSms;
  }
}
