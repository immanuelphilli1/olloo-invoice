import { createHmac } from 'node:crypto';
import { safeEqual } from '../lib/crypto';

/** The subset of a Paystack transaction we rely on (webhook `charge.success` data / verify response). */
export interface PaystackCharge {
  id?: number;
  reference: string;
  status: string;
  amount: number;
  metadata?: { business_id?: string; interval?: 'monthly' | 'yearly' } | string | null;
  customer?: { customer_code?: string; email?: string };
  plan?: { plan_code?: string; interval?: string } | string | null;
}

export interface PaystackClient {
  initialize(input: {
    email: string;
    amount: number;
    plan: string;
    callbackUrl: string;
    metadata: Record<string, string>;
  }): Promise<{ authorizationUrl: string; reference: string }>;
  verify(reference: string): Promise<PaystackCharge>;
  disableSubscription(code: string, emailToken: string): Promise<void>;
}

/** Webhooks are signed with HMAC-SHA512 of the raw body using the secret key. */
export function verifyPaystackSignature(secretKey: string, rawBody: string, signature: string | undefined): boolean {
  if (!secretKey || !signature) return false;
  const expected = createHmac('sha512', secretKey).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}

export function createPaystackClient(secretKey: string): PaystackClient {
  async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    if (!secretKey) throw new Error('PAYSTACK_SECRET_KEY is not set');
    const res = await fetch(`https://api.paystack.co${path}`, {
      method,
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: T };
    if (!res.ok || !json.status) throw new Error(`Paystack ${path}: ${json.message ?? res.status}`);
    return json.data as T;
  }

  return {
    async initialize({ email, amount, plan, callbackUrl, metadata }) {
      const data = await call<{ authorization_url: string; reference: string }>('POST', '/transaction/initialize', {
        email,
        amount, // Paystack uses the plan's amount when `plan` is set
        plan,
        currency: 'GHS',
        callback_url: callbackUrl,
        metadata,
      });
      return { authorizationUrl: data.authorization_url, reference: data.reference };
    },
    verify(reference) {
      return call<PaystackCharge>('GET', `/transaction/verify/${encodeURIComponent(reference)}`);
    },
    async disableSubscription(code, emailToken) {
      await call('POST', '/subscription/disable', { code, token: emailToken });
    },
  };
}
