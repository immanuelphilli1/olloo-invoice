import type { PublicDocument } from '@olloo/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { AppEnv } from '../context';
import { invoices, receipts } from '../db/schema';
import { HttpError } from '../lib/errors';
import { getPlan } from '../services/account';
import { toInvoiceDto, toReceiptDto } from '../services/documents';

/** GET /api/public/:token — read-only document for a share link. No login. */
export function publicRoutes() {
  return new Hono<AppEnv>().get('/:token', async (c) => {
    const { db, now } = c.var.deps;
    const token = c.req.param('token');
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw new HttpError(404, 'Document not found', 'not_found');

    const [invoice] = await db.select().from(invoices).where(eq(invoices.shareToken, token));
    if (invoice) {
      const plan = await getPlan(db, invoice.businessId, now());
      const body: PublicDocument = { kind: 'invoice', invoice: toInvoiceDto(invoice, plan.pro) };
      return c.json(body);
    }

    const [receipt] = await db.select().from(receipts).where(eq(receipts.shareToken, token));
    if (receipt) {
      const plan = await getPlan(db, receipt.businessId, now());
      let invoiceNumber: string | null = null;
      if (receipt.invoiceId) {
        const [inv] = await db
          .select({ number: invoices.number })
          .from(invoices)
          .where(eq(invoices.id, receipt.invoiceId));
        invoiceNumber = inv?.number ?? null;
      }
      const body: PublicDocument = { kind: 'receipt', receipt: toReceiptDto(receipt, invoiceNumber, plan.pro) };
      return c.json(body);
    }

    throw new HttpError(404, 'Document not found', 'not_found');
  });
}
