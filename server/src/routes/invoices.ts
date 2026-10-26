import {
  computeTotals,
  formatGhs,
  invoiceInputSchema,
  paymentInputSchema,
  voidSchema,
  type TaxRate,
} from '@olloo/shared';
import { and, desc, eq, gte, ilike, inArray, lte, or, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { requireBusiness } from '../auth/session';
import type { AppEnv } from '../context';
import type { DbOrTx } from '../db/client';
import { customers, invoices, receipts } from '../db/schema';
import { randomToken } from '../lib/crypto';
import { badRequest, HttpError, notFound } from '../lib/errors';
import { validate } from '../lib/validate';
import { assertCanIssue, buildSnapshot, getPlan } from '../services/account';
import { invoiceStatusFor, toInvoiceDto, toReceiptDto } from '../services/documents';
import { allocateNumber } from '../services/numbering';

export const listQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(5000).default(200),
});

export function enabledTaxes(taxRates: TaxRate[]) {
  return taxRates.filter((t) => t.enabled);
}

/** A customerId from the client is only kept if it belongs to this business. */
export async function ownedCustomerId(db: DbOrTx, businessId: string, customerId: string | null) {
  if (!customerId || !z.uuid().safeParse(customerId).success) return null;
  const [row] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.businessId, businessId)));
  return row?.id ?? null;
}

export function invoiceRoutes() {
  const app = new Hono<AppEnv>();
  app.use('*', requireBusiness);

  app.get('/', validate('query', listQuerySchema), async (c) => {
    const { db, now } = c.var.deps;
    const { q, status, from, to, limit } = c.req.valid('query');
    const businessId = c.var.business.id;
    const where: SQL[] = [eq(invoices.businessId, businessId)];
    if (q) where.push(or(ilike(invoices.number, `%${q}%`), ilike(invoices.customerName, `%${q}%`))!);
    if (status) {
      const statuses = status.split(',').filter((s) => ['issued', 'part_paid', 'paid', 'void'].includes(s));
      if (statuses.length) where.push(inArray(invoices.status, statuses as never[]));
    }
    if (from) where.push(gte(invoices.date, from));
    if (to) where.push(lte(invoices.date, to));

    const [rows, plan] = await Promise.all([
      db
        .select()
        .from(invoices)
        .where(and(...where))
        .orderBy(desc(invoices.date), desc(invoices.createdAt))
        .limit(limit),
      getPlan(db, businessId, now()),
    ]);
    return c.json(rows.map((r) => toInvoiceDto(r, plan.pro)));
  });

  app.post('/', validate('json', invoiceInputSchema), async (c) => {
    const { db, now } = c.var.deps;
    const body = c.req.valid('json');
    const business = c.var.business;

    const row = await db.transaction(async (tx) => {
      const plan = await assertCanIssue(tx, business.id, now());
      const number = await allocateNumber(tx, business.id, 'invoice');
      const totals = computeTotals(body.items, body.discount, enabledTaxes(business.taxRates));
      const [inserted] = await tx
        .insert(invoices)
        .values({
          businessId: business.id,
          number,
          customerId: await ownedCustomerId(tx, business.id, body.customerId),
          customerName: body.customerName,
          customerAddress: body.customerAddress,
          customerPhone: body.customerPhone,
          lpoNo: body.lpoNo,
          date: body.date,
          dueDate: body.dueDate,
          items: body.items,
          notes: body.notes,
          discount: body.discount,
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          taxes: totals.taxes,
          total: totals.total,
          snapshot: buildSnapshot(business, plan.entitlements),
          // app clock, not the DB clock: the monthly document count uses it
          createdAt: now(),
        })
        .returning();
      return { row: inserted!, pro: plan.pro };
    });
    return c.json(toInvoiceDto(row.row, row.pro), 201);
  });

  app.get('/:id', async (c) => {
    const { db, now } = c.var.deps;
    const businessId = c.var.business.id;
    const row = await findInvoice(db, businessId, c.req.param('id'));
    const [payments, plan] = await Promise.all([
      db
        .select()
        .from(receipts)
        .where(and(eq(receipts.businessId, businessId), eq(receipts.invoiceId, row.id)))
        .orderBy(receipts.createdAt),
      getPlan(db, businessId, now()),
    ]);
    return c.json({
      invoice: toInvoiceDto(row, plan.pro),
      receipts: payments.map((r) => toReceiptDto(r, row.number, plan.pro)),
    });
  });

  // Editable until the first payment; the number and snapshot never change.
  app.put('/:id', validate('json', invoiceInputSchema), async (c) => {
    const { db, now } = c.var.deps;
    const body = c.req.valid('json');
    const business = c.var.business;

    const updated = await db.transaction(async (tx) => {
      const current = await findInvoice(tx, business.id, c.req.param('id'), true);
      if (current.status === 'void') throw badRequest('A void invoice cannot be edited');
      if (current.amountPaid > 0) {
        throw badRequest('This invoice has payments, so it can no longer be edited. Void the receipts first.');
      }
      const totals = computeTotals(body.items, body.discount, enabledTaxes(business.taxRates));
      const [row] = await tx
        .update(invoices)
        .set({
          customerId: await ownedCustomerId(tx, business.id, body.customerId),
          customerName: body.customerName,
          customerAddress: body.customerAddress,
          customerPhone: body.customerPhone,
          lpoNo: body.lpoNo,
          date: body.date,
          dueDate: body.dueDate,
          items: body.items,
          notes: body.notes,
          discount: body.discount,
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          taxes: totals.taxes,
          total: totals.total,
          updatedAt: now(),
        })
        .where(eq(invoices.id, current.id))
        .returning();
      return row!;
    });
    const plan = await getPlan(db, business.id, now());
    return c.json(toInvoiceDto(updated, plan.pro));
  });

  app.post('/:id/void', validate('json', voidSchema), async (c) => {
    const { db, now } = c.var.deps;
    const businessId = c.var.business.id;
    const updated = await db.transaction(async (tx) => {
      const current = await findInvoice(tx, businessId, c.req.param('id'), true);
      if (current.status === 'void') throw badRequest('This invoice is already void');
      if (current.amountPaid > 0) throw badRequest('Void the receipts for this invoice first');
      const [row] = await tx
        .update(invoices)
        .set({ status: 'void', voidReason: c.req.valid('json').reason, updatedAt: now() })
        .where(eq(invoices.id, current.id))
        .returning();
      return row!;
    });
    const plan = await getPlan(db, businessId, now());
    return c.json(toInvoiceDto(updated, plan.pro));
  });

  // Record a payment → issues a classic receipt and updates the balance, atomically.
  app.post('/:id/payments', validate('json', paymentInputSchema), async (c) => {
    const { db, now } = c.var.deps;
    const body = c.req.valid('json');
    const business = c.var.business;

    const result = await db.transaction(async (tx) => {
      const plan = await assertCanIssue(tx, business.id, now());
      const invoice = await findInvoice(tx, business.id, c.req.param('id'), true);
      if (invoice.status === 'void') throw badRequest('Cannot record a payment on a void invoice');
      const balance = invoice.total - invoice.amountPaid;
      if (balance <= 0) throw badRequest('This invoice is already fully paid');
      if (body.amount > balance) throw badRequest(`That is more than the balance of ${formatGhs(balance)}`);

      const number = await allocateNumber(tx, business.id, 'receipt');
      const amountPaid = invoice.amountPaid + body.amount;
      const [receipt] = await tx
        .insert(receipts)
        .values({
          businessId: business.id,
          number,
          layout: 'classic',
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          customerName: invoice.customerName,
          customerAddress: invoice.customerAddress,
          customerPhone: invoice.customerPhone,
          date: body.date,
          method: body.method,
          reference: body.reference,
          paymentFor: body.paymentFor || `Payment for invoice № ${invoice.number}`,
          items: [],
          subtotal: body.amount,
          discount: { type: 'none', value: 0 },
          taxes: [],
          amount: body.amount,
          balanceAfter: invoice.total - amountPaid,
          snapshot: buildSnapshot(business, plan.entitlements),
          // app clock, not the DB clock: the monthly document count uses it
          createdAt: now(),
        })
        .returning();
      const [updatedInvoice] = await tx
        .update(invoices)
        .set({ amountPaid, status: invoiceStatusFor(invoice.total, amountPaid), updatedAt: now() })
        .where(eq(invoices.id, invoice.id))
        .returning();
      return { invoice: updatedInvoice!, receipt: receipt!, pro: plan.pro };
    });

    return c.json(
      {
        invoice: toInvoiceDto(result.invoice, result.pro),
        receipt: toReceiptDto(result.receipt, result.invoice.number, result.pro),
      },
      201
    );
  });

  app.post('/:id/share', async (c) => {
    const { db, now } = c.var.deps;
    const businessId = c.var.business.id;
    const plan = await getPlan(db, businessId, now());
    if (!plan.entitlements.publicLinks) {
      throw new HttpError(402, 'Share links are part of Pro.', 'pro_required');
    }
    const row = await findInvoice(db, businessId, c.req.param('id'));
    if (row.shareToken) return c.json({ shareToken: row.shareToken });
    const shareToken = randomToken(16);
    await db.update(invoices).set({ shareToken }).where(eq(invoices.id, row.id));
    return c.json({ shareToken });
  });

  app.delete('/:id/share', async (c) => {
    const { db } = c.var.deps;
    const row = await findInvoice(db, c.var.business.id, c.req.param('id'));
    await db.update(invoices).set({ shareToken: null }).where(eq(invoices.id, row.id));
    return c.json({ ok: true });
  });

  return app;
}

export async function findInvoice(db: DbOrTx, businessId: string, id: string, forUpdate = false) {
  if (!z.uuid().safeParse(id).success) throw notFound('Invoice not found');
  const query = db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.businessId, businessId)));
  const [row] = forUpdate ? await query.for('update') : await query;
  if (!row) throw new HttpError(404, 'Invoice not found', 'not_found');
  return row;
}
