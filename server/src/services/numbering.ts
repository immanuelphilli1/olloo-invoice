import { DEFAULT_PAD, DEFAULT_PREFIX, formatDocNumber, type DocKind } from '@olloo/shared';
import { and, eq, sql } from 'drizzle-orm';
import type { DbOrTx, Tx } from '../db/client';
import { counters, invoices, receipts } from '../db/schema';
import { HttpError } from '../lib/errors';

export async function createDefaultCounters(db: DbOrTx, businessId: string) {
  await db
    .insert(counters)
    .values(
      (['invoice', 'receipt'] as const).map((kind) => ({
        businessId,
        kind,
        prefix: DEFAULT_PREFIX[kind],
        nextNumber: 1,
        pad: DEFAULT_PAD,
      }))
    )
    .onConflictDoNothing();
}

/**
 * Take the next number in the series. The UPDATE row-locks the counter, so
 * concurrent creates in other transactions wait and get distinct numbers.
 * Must run inside the transaction that inserts the document.
 */
export async function allocateNumber(tx: Tx, businessId: string, kind: DocKind): Promise<string> {
  const [row] = await tx
    .update(counters)
    .set({ nextNumber: sql`${counters.nextNumber} + 1` })
    .where(and(eq(counters.businessId, businessId), eq(counters.kind, kind)))
    .returning({ taken: sql<number>`${counters.nextNumber} - 1`, prefix: counters.prefix, pad: counters.pad });
  if (!row) throw new Error(`No ${kind} counter for business ${businessId}`);

  const number = formatDocNumber(row.prefix, Number(row.taken), row.pad);

  // The owner can move the counter back in settings; never reuse a number.
  const table = kind === 'invoice' ? invoices : receipts;
  const [clash] = await tx
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.businessId, businessId), eq(table.number, number)));
  if (clash) {
    throw new HttpError(
      409,
      `${number} has already been used. Change the next ${kind} number in Settings → Numbering.`
    );
  }
  return number;
}
