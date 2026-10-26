import {
  DEFAULT_PAD,
  DEFAULT_PREFIX,
  DEFAULT_STYLE,
  effectiveStyle,
  entitlementsFor,
  isPro,
  sanitizeStyle,
  monthStart,
  type Business,
  type CompanyInfo,
  type DocumentSnapshot,
  type Entitlements,
  type SubscriptionInfo,
  type TaxRate,
  type User,
} from '@olloo/shared';
import { and, count, eq, gte } from 'drizzle-orm';
import type { BusinessRow, UserRow } from '../context';
import type { DbOrTx } from '../db/client';
import { counters, invoices, receipts, subscriptions } from '../db/schema';
import { HttpError } from '../lib/errors';

export const DEFAULT_TAX_RATES: TaxRate[] = [
  { id: 'vat', name: 'VAT', rateBps: 1500, enabled: false },
  { id: 'nhil', name: 'NHIL', rateBps: 250, enabled: false },
  { id: 'getfund', name: 'GETFund', rateBps: 250, enabled: false },
];

export const DEFAULT_BUSINESS_SETTINGS = {
  style: DEFAULT_STYLE,
  taxRates: DEFAULT_TAX_RATES,
};

export function fileUrl(key: string | null): string | null {
  return key ? `/api/files/${key}` : null;
}

export function toUserDto(u: UserRow): User {
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, isSuperadmin: u.isSuperadmin };
}

export function companyInfo(b: BusinessRow): CompanyInfo {
  return {
    name: b.name,
    location: b.location,
    poBox: b.poBox,
    phone: b.phone,
    email: b.email,
    tin: b.tin,
    footerText: b.footerText,
    logoUrl: fileUrl(b.logoKey),
    signatureUrl: fileUrl(b.signatureKey),
  };
}

export async function toBusinessDto(db: DbOrTx, b: BusinessRow): Promise<Business> {
  const rows = await db.select().from(counters).where(eq(counters.businessId, b.id));
  const counter = (kind: 'invoice' | 'receipt') => {
    const row = rows.find((r) => r.kind === kind);
    return {
      prefix: row?.prefix ?? DEFAULT_PREFIX[kind],
      nextNumber: row?.nextNumber ?? 1,
      pad: row?.pad ?? DEFAULT_PAD,
    };
  };
  return {
    ...companyInfo(b),
    id: b.id,
    // styles saved before receipt templates existed lack receiptTemplate
    style: sanitizeStyle(b.style),
    taxRates: b.taxRates,
    counters: { invoice: counter('invoice'), receipt: counter('receipt') },
  };
}

export type SubscriptionRow = typeof subscriptions.$inferSelect;

export async function getSubscription(db: DbOrTx, businessId: string): Promise<SubscriptionRow | null> {
  const [row] = await db.select().from(subscriptions).where(eq(subscriptions.businessId, businessId));
  return row ?? null;
}

export function subscriptionDto(sub: SubscriptionRow | null, now: Date): SubscriptionInfo {
  const pro = isPro(sub, now);
  return {
    plan: pro ? 'pro' : 'free',
    interval: sub?.interval ?? null,
    currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
    comp: sub?.comp ?? false,
    autoRenew: sub?.autoRenew ?? false,
    paymentFailed: sub?.paymentFailed ?? false,
  };
}

export interface Plan {
  pro: boolean;
  entitlements: Entitlements;
  subscription: SubscriptionRow | null;
}

export async function getPlan(db: DbOrTx, businessId: string, now: Date): Promise<Plan> {
  const subscription = await getSubscription(db, businessId);
  const pro = isPro(subscription, now);
  return { pro, entitlements: entitlementsFor(pro), subscription };
}

/** Invoices + receipts created since the start of this calendar month (voided ones still count). */
export async function docsThisMonth(db: DbOrTx, businessId: string, now: Date): Promise<number> {
  const since = monthStart(now);
  const [[inv], [rct]] = await Promise.all([
    db
      .select({ n: count() })
      .from(invoices)
      .where(and(eq(invoices.businessId, businessId), gte(invoices.createdAt, since))),
    db
      .select({ n: count() })
      .from(receipts)
      .where(and(eq(receipts.businessId, businessId), gte(receipts.createdAt, since))),
  ]);
  return (inv?.n ?? 0) + (rct?.n ?? 0);
}

/** Throws 402 when a Free business has used its monthly documents. Call inside the create transaction. */
export async function assertCanIssue(db: DbOrTx, businessId: string, now: Date): Promise<Plan> {
  const plan = await getPlan(db, businessId, now);
  const limit = plan.entitlements.monthlyDocLimit;
  if (limit != null && (await docsThisMonth(db, businessId, now)) >= limit) {
    throw new HttpError(
      402,
      `The Free plan includes ${limit} documents a month. Upgrade to Pro for unlimited invoices and receipts.`,
      'limit_reached'
    );
  }
  return plan;
}

export function buildSnapshot(b: BusinessRow, entitlements: Entitlements): DocumentSnapshot {
  return {
    company: companyInfo(b),
    style: effectiveStyle(sanitizeStyle(b.style), entitlements.templates),
    watermark: entitlements.watermark,
  };
}

/**
 * The watermark is frozen at issue time, but upgrading to Pro lifts it from
 * older documents too — and lapsing never adds it to documents issued on Pro.
 */
export function presentSnapshot(snapshot: DocumentSnapshot, currentlyPro: boolean): DocumentSnapshot {
  return currentlyPro && snapshot.watermark ? { ...snapshot, watermark: false } : snapshot;
}
