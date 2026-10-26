import { computeTotals, NO_DISCOUNT, receiptInputSchema, voidSchema } from '@olloo/shared';
import { and, desc, eq, gte, ilike, inArray, lte, or, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { requireBusiness } from '../auth/session';
import type { AppEnv } from '../context';
import type { DbOrTx } from '../db/client';
import { invoices, receipts } from '../db/schema';
import { randomToken } from '../lib/crypto';
import { badRequest, HttpError, notFound } from '../lib/errors';
import { validate } from '../lib/validate';
import { assertCanIssue, buildSnapshot, getPlan } from '../services/account';
import { invoiceStatusFor, toReceiptDto } from '../services/documents';
import { allocateNumber } from '../services/numbering';
import { enabledTaxes, findInvoice, listQuerySchema, ownedCustomerId } from './invoices';

const receiptListQuery = listQuerySchema.extend({ invoiceId: z.uuid().optional() });

/** invoice id → number, for the "being payment for invoice №" line. */
async function invoiceNumbers(db: DbOrTx, businessId: string, ids: (string | null)[]) {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (!unique.length) return new Map<string, string>();
  const rows = await db
    .select({ id: invoices.id, number: invoices.number })
    .from(invoices)
    .where(and(eq(invoices.businessId, businessId), inArray(invoices.id, unique)));
  return new Map(rows.map((r) => [r.id, r.number]));
}

export function receiptRoutes() {
  const app = new Hono<AppEnv>();
  app.use('*', requireBusiness);

  app.get('/', validate('query', receiptListQuery), async (c) => {
    const { db, now } = c.var.deps;
    const { q, status, from, to, limit, invoiceId } = c.req.valid('query');
    const businessId = c.var.business.id;
    const where: SQL[] = [eq(receipts.businessId, businessId)];
    if (q) where.push(or(ilike(receipts.number, `%${q}%`), ilike(receipts.customerName, `%${q}%`))!);
    if (status === 'issued' || status === 'void') where.push(eq(receipts.status, status));
    if (from) where.push(gte(receipts.date, from));
    if (to) where.push(lte(receipts.date, to));
    if (invoiceId) where.push(eq(receipts.invoiceId, invoiceId));

    const [rows, plan] = await Promise.all([
      db
        .select()
        .from(receipts)
        .where(and(...where))
        .orderBy(desc(receipts.date), desc(receipts.createdAt))
        .limit(limit),
      getPlan(db, businessId, now()),
    ]);
    const numbers = await invoiceNumbers(db, businessId, rows.map((r) => r.invoiceId));
    return c.json(rows.map((r) => toReceiptDto(r, r.invoiceId ? (numbers.get(r.invoiceId) ?? null) : null, plan.pro)));
  });

  // Standalone receipt (walk-in sale or payment not tied to an invoice).
  app.post('/', validate('json', receiptInputSchema), async (c) => {
    const { db, now } = c.var.deps;
    const body = c.req.valid('json');
    const business = c.var.business;

    const result = await db.transaction(async (tx) => {
      const plan = await assertCanIssue(tx, business.id, now());
      const amounts =
        body.layout === 'itemized'
          ? (() => {
              const t = computeTotals(body.items, body.discount, enabledTaxes(business.taxRates));
              return { items: body.items, discount: body.discount, ...t, amount: t.total };
            })()
          : {
              items: [],
              discount: NO_DISCOUNT,
              subtotal: body.amount,
              discountAmount: 0,
              taxes: [],
              amount: body.amount,
            };
      if (amounts.amount <= 0) throw badRequest('The receipt total must be more than zero');

      const number = await allocateNumber(tx, business.id, 'receipt');
      const [row] = await tx
        .insert(receipts)
        .values({
          businessId: business.id,
          number,
          layout: body.layout,
          customerId: await ownedCustomerId(tx, business.id, body.customerId),
          customerName: body.customerName,
          customerAddress: body.customerAddress,
          customerPhone: body.customerPhone,
          date: body.date,
          method: body.method,
          reference: body.reference,
          paymentFor: body.paymentFor,
          items: amounts.items,
          subtotal: amounts.subtotal,
          discount: amounts.discount,
          discountAmount: amounts.discountAmount,
          taxes: amounts.taxes,
          amount: amounts.amount,
          snapshot: buildSnapshot(business, plan.entitlements),
          // app clock, not the DB clock: the monthly document count uses it
          createdAt: now(),
        })
        .returning();
      return { row: row!, pro: plan.pro };
    });
    return c.json(toReceiptDto(result.row, null, result.pro), 201);
  });

  app.get('/:id', async (c) => {
    const { db, now } = c.var.deps;
    const businessId = c.var.business.id;
    const row = await findReceipt(db, businessId, c.req.param('id'));
    const [numbers, plan] = await Promise.all([
      invoiceNumbers(db, businessId, [row.invoiceId]),
      getPlan(db, businessId, now()),
    ]);
    return c.json(toReceiptDto(row, row.invoiceId ? (numbers.get(row.invoiceId) ?? null) : null, plan.pro));
  });

  // Voiding a payment receipt gives the amount back to the invoice's balance.
  app.post('/:id/void', validate('json', voidSchema), async (c) => {
    const { db, now } = c.var.deps;
    const businessId = c.var.business.id;
    const row = await db.transaction(async (tx) => {
      const receipt = await findReceipt(tx, businessId, c.req.param('id'), true);
      if (receipt.status === 'void') throw badRequest('This receipt is already void');
      if (receipt.invoiceId) {
        const invoice = await findInvoice(tx, businessId, receipt.invoiceId, true);
        const amountPaid = Math.max(invoice.amountPaid - receipt.amount, 0);
        await tx
          .update(invoices)
          .set({ amountPaid, status: invoiceStatusFor(invoice.total, amountPaid), updatedAt: now() })
          .where(eq(invoices.id, invoice.id));
      }
      const [updated] = await tx
        .update(receipts)
        .set({ status: 'void', voidReason: c.req.valid('json').reason })
        .where(eq(receipts.id, receipt.id))
        .returning();
      return updated!;
    });
    const [numbers, plan] = await Promise.all([
      invoiceNumbers(db, businessId, [row.invoiceId]),
      getPlan(db, businessId, now()),
    ]);
    return c.json(toReceiptDto(row, row.invoiceId ? (numbers.get(row.invoiceId) ?? null) : null, plan.pro));
  });

  app.post('/:id/share', async (c) => {
    const { db, now } = c.var.deps;
    const businessId = c.var.business.id;
    const plan = await getPlan(db, businessId, now());
    if (!plan.entitlements.publicLinks) {
      throw new HttpError(402, 'Share links are part of Pro.', 'pro_required');
    }
    const row = await findReceipt(db, businessId, c.req.param('id'));
    if (row.shareToken) return c.json({ shareToken: row.shareToken });
    const shareToken = randomToken(16);
    await db.update(receipts).set({ shareToken }).where(eq(receipts.id, row.id));
    return c.json({ shareToken });
  });

  app.delete('/:id/share', async (c) => {
    const { db } = c.var.deps;
    const row = await findReceipt(db, c.var.business.id, c.req.param('id'));
    await db.update(receipts).set({ shareToken: null }).where(eq(receipts.id, row.id));
    return c.json({ ok: true });
  });

  return app;
}

async function findReceipt(db: DbOrTx, businessId: string, id: string, forUpdate = false) {
  if (!z.uuid().safeParse(id).success) throw notFound('Receipt not found');
  const query = db
    .select()
    .from(receipts)
    .where(and(eq(receipts.id, id), eq(receipts.businessId, businessId)));
  const [row] = forUpdate ? await query.for('update') : await query;
  if (!row) throw new HttpError(404, 'Receipt not found', 'not_found');
  return row;
}
