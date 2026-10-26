import type { Pesewas } from './money';

export type PlanId = 'free' | 'pro';
export type BillingInterval = 'monthly' | 'yearly';

/**
 * Prices shown in the app. The amount actually charged comes from the
 * Paystack Plan (PAYSTACK_PLAN_MONTHLY / _YEARLY), so keep these in sync.
 */
export const PRO_PRICE: Record<BillingInterval, Pesewas> = {
  monthly: 50_00,
  yearly: 500_00,
};

/** Invoices + receipts combined, per calendar month. */
export const FREE_MONTHLY_DOC_LIMIT = 10;

/** Reminder sent this many days before a non-renewing period ends. */
export const RENEWAL_REMINDER_DAYS = 3;

export interface Entitlements {
  plan: PlanId;
  /** null = unlimited */
  monthlyDocLimit: number | null;
  /** may pick templates other than Classic Ink */
  templates: boolean;
  /** "Made with olloo" watermark on documents */
  watermark: boolean;
  publicLinks: boolean;
}

export interface SubscriptionLike {
  comp: boolean;
  currentPeriodEnd: Date | string | null;
}

export function isPro(sub: SubscriptionLike | null | undefined, now = new Date()): boolean {
  if (!sub) return false;
  if (sub.comp) return true;
  if (!sub.currentPeriodEnd) return false;
  return new Date(sub.currentPeriodEnd).getTime() > now.getTime();
}

export function entitlementsFor(pro: boolean): Entitlements {
  return pro
    ? { plan: 'pro', monthlyDocLimit: null, templates: true, watermark: false, publicLinks: true }
    : {
        plan: 'free',
        monthlyDocLimit: FREE_MONTHLY_DOC_LIMIT,
        templates: false,
        watermark: true,
        publicLinks: false,
      };
}

/**
 * Start of the current calendar month. Ghana (Africa/Accra) is UTC+0 with no
 * daylight saving, so the UTC month boundary is the local one.
 */
export function monthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Add calendar months, clamping the day (Jan 31 + 1 month → Feb 28/29, not Mar 3). */
export function addMonthsUtc(d: Date, months: number): Date {
  const next = new Date(d);
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + months);
  const daysInMonth = new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)
  ).getUTCDate();
  next.setUTCDate(Math.min(day, daysInMonth));
  return next;
}

/** Extend a period: from the later of now / current end, add one interval. */
export function extendPeriod(
  currentEnd: Date | null,
  interval: BillingInterval,
  now = new Date()
): Date {
  const start = currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now;
  return addMonthsUtc(start, interval === 'yearly' ? 12 : 1);
}
