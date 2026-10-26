import { addMonthsUtc, isPro } from '@olloo/shared';
import { desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { requireSuperadmin } from '../auth/session';
import type { AppEnv } from '../context';
import { businesses, subscriptions, users } from '../db/schema';
import { notFound } from '../lib/errors';
import { validate } from '../lib/validate';
import { docsThisMonth } from '../services/account';

export interface AdminBusinessRow {
  id: string;
  name: string;
  ownerName: string;
  ownerEmail: string | null;
  ownerPhone: string | null;
  plan: 'free' | 'pro';
  comp: boolean;
  autoRenew: boolean;
  currentPeriodEnd: string | null;
  docsThisMonth: number;
  createdAt: string;
}

const subscriptionUpdate = z.object({
  comp: z.boolean().optional(),
  /** add months of Pro, e.g. when a MoMo payment went through but the webhook didn't */
  extendMonths: z.number().int().min(1).max(24).optional(),
});

export function adminRoutes() {
  const app = new Hono<AppEnv>();
  app.use('*', requireSuperadmin);

  app.get('/businesses', async (c) => {
    const { db, now } = c.var.deps;
    const rows = await db
      .select({ business: businesses, owner: users, sub: subscriptions })
      .from(businesses)
      .innerJoin(users, eq(users.id, businesses.ownerUserId))
      .leftJoin(subscriptions, eq(subscriptions.businessId, businesses.id))
      .orderBy(desc(businesses.createdAt))
      .limit(500);
    const result: AdminBusinessRow[] = await Promise.all(
      rows.map(async ({ business, owner, sub }) => ({
        id: business.id,
        name: business.name,
        ownerName: owner.name,
        ownerEmail: owner.email,
        ownerPhone: owner.phone,
        plan: isPro(sub, now()) ? 'pro' : 'free',
        comp: sub?.comp ?? false,
        autoRenew: sub?.autoRenew ?? false,
        currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
        docsThisMonth: await docsThisMonth(db, business.id, now()),
        createdAt: business.createdAt.toISOString(),
      }))
    );
    return c.json(result);
  });

  app.put('/businesses/:id/subscription', validate('json', subscriptionUpdate), async (c) => {
    const { db, now } = c.var.deps;
    const body = c.req.valid('json');
    const id = c.req.param('id');
    if (!z.uuid().safeParse(id).success) throw notFound('Business not found');
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.businessId, id));
    if (!sub) throw notFound('Business not found');

    const base = sub.currentPeriodEnd && sub.currentPeriodEnd > now() ? sub.currentPeriodEnd : now();
    await db
      .update(subscriptions)
      .set({
        ...(body.comp !== undefined ? { comp: body.comp } : {}),
        ...(body.extendMonths ? { currentPeriodEnd: addMonthsUtc(base, body.extendMonths) } : {}),
        updatedAt: now(),
      })
      .where(eq(subscriptions.businessId, id));
    return c.json({ ok: true });
  });

  return app;
}
