import { checkoutSchema, PRO_PRICE } from '@olloo/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { verifyPaystackSignature } from '../billing/paystack';
import { applyCharge, claimWebhook, handlePaystackEvent } from '../billing/subscriptions';
import { requireBusiness } from '../auth/session';
import type { AppEnv } from '../context';
import { subscriptions } from '../db/schema';
import { sha256 } from '../lib/crypto';
import { badRequest, HttpError } from '../lib/errors';
import { validate } from '../lib/validate';
import { getSubscription, subscriptionDto } from '../services/account';

export function billingRoutes() {
  const app = new Hono<AppEnv>();

  // Paystack → us. Authenticated by signature, not by session.
  app.post('/webhook', async (c) => {
    const deps = c.var.deps;
    const raw = await c.req.text();
    if (!verifyPaystackSignature(deps.env.paystackSecretKey, raw, c.req.header('x-paystack-signature'))) {
      return c.json({ error: 'Invalid signature' }, 401);
    }
    let payload: { event: string; data: Record<string, unknown> };
    try {
      payload = JSON.parse(raw);
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400);
    }
    if (await claimWebhook(deps, `webhook:${sha256(raw)}`, payload.event, payload)) {
      await handlePaystackEvent(deps, payload);
    }
    return c.json({ ok: true });
  });

  app.use('*', requireBusiness);

  app.post('/checkout', validate('json', checkoutSchema), async (c) => {
    const { db, env, paystack } = c.var.deps;
    const { interval, email: bodyEmail } = c.req.valid('json');
    const plan = interval === 'yearly' ? env.paystackPlanYearly : env.paystackPlanMonthly;
    if (!env.paystackSecretKey || !plan) throw new HttpError(503, 'Payments are not set up yet. Please try again later.');

    const businessId = c.var.business.id;
    const sub = await getSubscription(db, businessId);
    const email = bodyEmail ?? sub?.billingEmail ?? c.var.user.email;
    if (!email) throw badRequest('Enter an email address for your Paystack receipt');
    if (sub?.comp) throw badRequest('Your account already has complimentary Pro');

    await db.update(subscriptions).set({ billingEmail: email }).where(eq(subscriptions.businessId, businessId));
    const { authorizationUrl, reference } = await paystack.initialize({
      email,
      amount: PRO_PRICE[interval],
      plan,
      callbackUrl: `${env.appUrl}/billing/return`,
      metadata: { business_id: businessId, interval },
    });
    return c.json({ authorizationUrl, reference });
  });

  // Called by the web app when Paystack redirects back, so Pro unlocks without waiting for the webhook.
  app.get('/verify', validate('query', z.object({ reference: z.string().min(1).max(100) })), async (c) => {
    const deps = c.var.deps;
    const charge = await deps.paystack.verify(c.req.valid('query').reference);
    const meta = typeof charge.metadata === 'string' ? JSON.parse(charge.metadata || '{}') : charge.metadata;
    if (meta?.business_id !== c.var.business.id) throw badRequest('This payment belongs to another account');
    await applyCharge(deps, charge);
    const sub = await getSubscription(deps.db, c.var.business.id);
    return c.json({ status: charge.status, subscription: subscriptionDto(sub, deps.now()) });
  });

  // Stop card auto-renew; Pro stays on until the paid period ends.
  app.post('/cancel', async (c) => {
    const { db, paystack, now } = c.var.deps;
    const sub = await getSubscription(db, c.var.business.id);
    if (sub?.paystackSubscriptionCode && sub.paystackEmailToken) {
      await paystack.disableSubscription(sub.paystackSubscriptionCode, sub.paystackEmailToken);
    }
    await db
      .update(subscriptions)
      .set({ autoRenew: false, updatedAt: now() })
      .where(eq(subscriptions.businessId, c.var.business.id));
    return c.json(subscriptionDto(await getSubscription(db, c.var.business.id), now()));
  });

  return app;
}
