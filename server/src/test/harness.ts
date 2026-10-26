import { createHmac } from 'node:crypto';
import type { Me } from '@olloo/shared';
import { eq } from 'drizzle-orm';
import { createApp } from '../app';
import type { PaystackCharge, PaystackClient } from '../billing/paystack';
import type { Deps } from '../context';
import { openDatabase } from '../db/client';
import { subscriptions } from '../db/schema';
import { env as baseEnv } from '../env';
import type { Mail } from '../providers/mail';
import { memoryStorage } from '../providers/storage';

export const PAYSTACK_SECRET = 'sk_test_secret';

export async function createHarness() {
  const database = await openDatabase({ dataDir: 'memory://' });
  const sms: Array<{ to: string; message: string }> = [];
  const mail: Mail[] = [];
  const charges = new Map<string, PaystackCharge>();
  let clock = new Date('2026-03-10T09:00:00Z');

  const paystack: PaystackClient = {
    async initialize({ metadata }) {
      const reference = `ref_${charges.size + 1}`;
      charges.set(reference, {
        reference,
        status: 'success',
        amount: metadata.interval === 'yearly' ? 50000 : 5000,
        metadata,
        customer: { customer_code: 'CUS_1', email: 'owner@example.com' },
      });
      return { authorizationUrl: `https://checkout.paystack.test/${reference}`, reference };
    },
    async verify(reference) {
      const charge = charges.get(reference);
      if (!charge) throw new Error('unknown reference');
      return charge;
    },
    async disableSubscription() {},
  };

  const deps: Deps = {
    db: database.db,
    env: {
      ...baseEnv,
      appUrl: 'http://localhost:5173',
      paystackSecretKey: PAYSTACK_SECRET,
      paystackPlanMonthly: 'PLN_monthly',
      paystackPlanYearly: 'PLN_yearly',
      superadmins: ['admin@olloo.app'],
    },
    sms: { send: async (to, message) => void sms.push({ to, message }) },
    mailer: { send: async (m) => void mail.push(m) },
    storage: memoryStorage(),
    paystack,
    now: () => clock,
  };
  const app = createApp(deps);

  /** A browser-like client with its own cookie jar. */
  function client() {
    let cookie = '';
    async function request(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
      const init: RequestInit = { method, headers: { ...headers, ...(cookie ? { cookie } : {}) } };
      if (body instanceof FormData) init.body = body;
      else if (body !== undefined) {
        init.body = JSON.stringify(body);
        (init.headers as Record<string, string>)['content-type'] = 'application/json';
      }
      const res = await app.request(path, init);
      const setCookie = res.headers.get('set-cookie');
      if (setCookie) cookie = setCookie.split(';')[0]!;
      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = text;
      }
      return { status: res.status, body: json };
    }
    return {
      get: (path: string) => request('GET', path),
      post: (path: string, body?: unknown, headers?: Record<string, string>) => request('POST', path, body, headers),
      put: (path: string, body?: unknown) => request('PUT', path, body),
      del: (path: string) => request('DELETE', path),
    };
  }

  /** Sign up with email and create a business. */
  async function owner(email: string, businessName = 'Test Traders') {
    const c = client();
    const signup = await c.post('/api/auth/signup', { name: 'Owner', email, password: 'password123' });
    if (signup.status !== 201) throw new Error(`signup failed: ${JSON.stringify(signup.body)}`);
    const created = await c.post('/api/business', { name: businessName, location: 'Accra' });
    if (created.status !== 201) throw new Error(`business failed: ${JSON.stringify(created.body)}`);
    return { client: c, me: created.body as Me };
  }

  async function makePro(businessId: string) {
    await database.db.update(subscriptions).set({ comp: true }).where(eq(subscriptions.businessId, businessId));
  }

  function signedWebhook(payload: unknown) {
    const raw = JSON.stringify(payload);
    const signature = createHmac('sha512', PAYSTACK_SECRET).update(raw).digest('hex');
    return app.request('/api/billing/webhook', {
      method: 'POST',
      body: raw,
      headers: { 'content-type': 'application/json', 'x-paystack-signature': signature },
    });
  }

  return {
    app,
    deps,
    db: database.db,
    sms,
    mail,
    client,
    owner,
    makePro,
    signedWebhook,
    setNow: (d: Date) => {
      clock = d;
    },
    close: database.close,
  };
}

export type Harness = Awaited<ReturnType<typeof createHarness>>;

export const sampleInvoice = (overrides: Record<string, unknown> = {}) => ({
  customerName: 'Kofi Mensah',
  customerAddress: 'Kumasi',
  date: '2026-03-10',
  items: [
    { qty: '2', description: 'Cement', unitPrice: 9000, amount: 18000 },
    { qty: '1', description: 'Delivery', unitPrice: null, amount: 2050 },
  ],
  ...overrides,
});
