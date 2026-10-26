import { extendPeriod, PRO_PRICE, type BillingInterval } from '@olloo/shared';
import { eq, or } from 'drizzle-orm';
import type { Deps } from '../context';
import { paystackEvents, subscriptions } from '../db/schema';
import type { PaystackCharge } from './paystack';

function parseMetadata(raw: PaystackCharge['metadata']): { business_id?: string; interval?: string } {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as { business_id?: string; interval?: string };
    } catch {
      return {};
    }
  }
  return raw;
}

function intervalForCharge(deps: Deps, charge: PaystackCharge, metaInterval?: string): BillingInterval | null {
  if (metaInterval === 'monthly' || metaInterval === 'yearly') return metaInterval;
  const plan = typeof charge.plan === 'object' && charge.plan ? charge.plan : null;
  const code = plan?.plan_code ?? (typeof charge.plan === 'string' ? charge.plan : undefined);
  if (code && code === deps.env.paystackPlanMonthly) return 'monthly';
  if (code && code === deps.env.paystackPlanYearly) return 'yearly';
  if (plan?.interval === 'annually') return 'yearly';
  if (plan?.interval === 'monthly') return 'monthly';
  return null;
}

/** Record a webhook delivery; returns false if this exact delivery was already processed. */
export async function claimWebhook(deps: Deps, id: string, event: string, payload: unknown): Promise<boolean> {
  const rows = await deps.db
    .insert(paystackEvents)
    .values({ id, event, payload: payload as object })
    .onConflictDoNothing()
    .returning({ id: paystackEvents.id });
  return rows.length > 0;
}

/**
 * A successful charge (first payment, card renewal or MoMo top-up) extends
 * Pro by one interval. Keyed on the transaction reference, so the webhook and
 * the post-checkout verify call can both run without double-crediting.
 */
export async function applyCharge(deps: Deps, charge: PaystackCharge): Promise<'applied' | 'duplicate' | 'ignored'> {
  if (charge.status !== 'success') return 'ignored';
  const meta = parseMetadata(charge.metadata);
  const interval = intervalForCharge(deps, charge, meta.interval);
  const customerCode = charge.customer?.customer_code ?? null;

  let businessId = meta.business_id ?? null;
  if (!businessId && customerCode) {
    const [row] = await deps.db
      .select({ businessId: subscriptions.businessId })
      .from(subscriptions)
      .where(eq(subscriptions.paystackCustomerCode, customerCode));
    businessId = row?.businessId ?? null;
  }
  if (!businessId || !interval) {
    console.warn(`[billing] charge ${charge.reference}: cannot match business/interval`);
    return 'ignored';
  }
  if (charge.amount < PRO_PRICE[interval]) {
    console.warn(`[billing] charge ${charge.reference}: amount ${charge.amount} below ${interval} price`);
    return 'ignored';
  }

  return deps.db.transaction(async (tx) => {
    const claimed = await tx
      .insert(paystackEvents)
      .values({ id: `charge:${charge.reference}`, event: 'charge.success', payload: charge as unknown as object })
      .onConflictDoNothing()
      .returning({ id: paystackEvents.id });
    if (!claimed.length) return 'duplicate' as const;

    const [sub] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.businessId, businessId!))
      .for('update');
    const values = {
      interval,
      currentPeriodEnd: extendPeriod(sub?.currentPeriodEnd ?? null, interval, deps.now()),
      paystackCustomerCode: customerCode ?? sub?.paystackCustomerCode ?? null,
      billingEmail: charge.customer?.email ?? sub?.billingEmail ?? null,
      paymentFailed: false,
      lastReminderAt: null,
      updatedAt: deps.now(),
    };
    if (sub) await tx.update(subscriptions).set(values).where(eq(subscriptions.businessId, businessId!));
    else await tx.insert(subscriptions).values({ businessId: businessId!, ...values });
    return 'applied' as const;
  });
}

interface WebhookPayload {
  event: string;
  data: Record<string, unknown> & {
    id?: number;
    subscription_code?: string;
    email_token?: string;
    customer?: { customer_code?: string; email?: string };
    subscription?: { subscription_code?: string };
  };
}

export async function handlePaystackEvent(deps: Deps, payload: WebhookPayload): Promise<void> {
  const { event, data } = payload;

  if (event === 'charge.success') {
    await applyCharge(deps, data as unknown as PaystackCharge);
    return;
  }

  // The remaining events only set flags, so a redelivery is harmless.
  const subscriptionCode = data.subscription_code ?? data.subscription?.subscription_code;

  if (event === 'subscription.create') {
    // May arrive before charge.success stored the customer code — fall back to the billing email.
    const code = data.customer?.customer_code;
    const email = data.customer?.email;
    const match = [
      code ? eq(subscriptions.paystackCustomerCode, code) : undefined,
      email ? eq(subscriptions.billingEmail, email) : undefined,
    ].filter(Boolean);
    if (!match.length) return;
    await deps.db
      .update(subscriptions)
      .set({
        paystackSubscriptionCode: subscriptionCode ?? null,
        paystackEmailToken: data.email_token ?? null,
        paystackCustomerCode: code ?? null,
        autoRenew: true,
        updatedAt: deps.now(),
      })
      .where(or(...match));
    return;
  }

  if (!subscriptionCode) return;

  if (event === 'subscription.disable' || event === 'subscription.not_renew') {
    await deps.db
      .update(subscriptions)
      .set({ autoRenew: false, updatedAt: deps.now() })
      .where(eq(subscriptions.paystackSubscriptionCode, subscriptionCode));
    return;
  }

  if (event === 'invoice.payment_failed') {
    await deps.db
      .update(subscriptions)
      .set({ paymentFailed: true, updatedAt: deps.now() })
      .where(eq(subscriptions.paystackSubscriptionCode, subscriptionCode));
  }
}
