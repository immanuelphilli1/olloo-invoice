import { monthStart, type DashboardSummary } from '@olloo/shared';
import { and, count, desc, eq, gte, inArray, ne, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { requireBusiness } from '../auth/session';
import type { AppEnv } from '../context';
import { invoices, receipts } from '../db/schema';

export function dashboardRoutes() {
  return new Hono<AppEnv>().use('*', requireBusiness).get('/', async (c) => {
    const { db, now } = c.var.deps;
    const businessId = c.var.business.id;
    // Document dates are calendar dates; Ghana is UTC, so the UTC month start is the local one.
    const fromDate = monthStart(now()).toISOString().slice(0, 10);
    const sum = (col: typeof invoices.total | typeof receipts.amount) =>
      sql<string>`coalesce(sum(${col}), 0)`.mapWith(Number);

    const [[billed], [collected], [open], recentInvoices, recentReceipts] = await Promise.all([
      db
        .select({ v: sum(invoices.total) })
        .from(invoices)
        .where(and(eq(invoices.businessId, businessId), ne(invoices.status, 'void'), gte(invoices.date, fromDate))),
      db
        .select({ v: sum(receipts.amount) })
        .from(receipts)
        .where(and(eq(receipts.businessId, businessId), eq(receipts.status, 'issued'), gte(receipts.date, fromDate))),
      db
        .select({
          outstanding: sql<string>`coalesce(sum(${invoices.total} - ${invoices.amountPaid}), 0)`.mapWith(Number),
          n: count(),
        })
        .from(invoices)
        .where(and(eq(invoices.businessId, businessId), inArray(invoices.status, ['issued', 'part_paid']))),
      db
        .select()
        .from(invoices)
        .where(eq(invoices.businessId, businessId))
        .orderBy(desc(invoices.createdAt))
        .limit(8),
      db
        .select()
        .from(receipts)
        .where(eq(receipts.businessId, businessId))
        .orderBy(desc(receipts.createdAt))
        .limit(8),
    ]);

    const recent = [
      ...recentInvoices.map((r) => ({
        kind: 'invoice' as const,
        id: r.id,
        number: r.number,
        customerName: r.customerName,
        date: r.date,
        amount: r.total,
        status: r.status,
        createdAt: r.createdAt,
      })),
      ...recentReceipts.map((r) => ({
        kind: 'receipt' as const,
        id: r.id,
        number: r.number,
        customerName: r.customerName,
        date: r.date,
        amount: r.amount,
        status: r.status,
        createdAt: r.createdAt,
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 8)
      .map(({ createdAt: _createdAt, ...rest }) => rest);

    const summary: DashboardSummary = {
      billedThisMonth: billed?.v ?? 0,
      collectedThisMonth: collected?.v ?? 0,
      outstanding: open?.outstanding ?? 0,
      unpaidCount: open?.n ?? 0,
      recent,
    };
    return c.json(summary);
  });
}
