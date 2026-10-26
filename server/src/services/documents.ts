import type { Invoice, InvoiceStatus, Receipt } from '@olloo/shared';
import type { invoices, receipts } from '../db/schema';
import { presentSnapshot } from './account';

export type InvoiceRow = typeof invoices.$inferSelect;
export type ReceiptRow = typeof receipts.$inferSelect;

export function invoiceStatusFor(total: number, amountPaid: number): InvoiceStatus {
  if (amountPaid <= 0) return 'issued';
  return amountPaid >= total ? 'paid' : 'part_paid';
}

export function toInvoiceDto(row: InvoiceRow, currentlyPro: boolean): Invoice {
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    customerId: row.customerId,
    customerName: row.customerName,
    customerAddress: row.customerAddress,
    customerPhone: row.customerPhone,
    lpoNo: row.lpoNo,
    date: row.date,
    dueDate: row.dueDate,
    items: row.items,
    notes: row.notes,
    subtotal: row.subtotal,
    discount: row.discount,
    discountAmount: row.discountAmount,
    taxes: row.taxes,
    total: row.total,
    amountPaid: row.amountPaid,
    balance: row.status === 'void' ? 0 : Math.max(row.total - row.amountPaid, 0),
    voidReason: row.voidReason,
    shareToken: row.shareToken,
    snapshot: presentSnapshot(row.snapshot, currentlyPro),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toReceiptDto(row: ReceiptRow, invoiceNumber: string | null, currentlyPro: boolean): Receipt {
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    layout: row.layout,
    invoiceId: row.invoiceId,
    invoiceNumber,
    customerId: row.customerId,
    customerName: row.customerName,
    customerAddress: row.customerAddress,
    customerPhone: row.customerPhone,
    date: row.date,
    method: row.method,
    reference: row.reference,
    paymentFor: row.paymentFor,
    items: row.items,
    subtotal: row.subtotal,
    discount: row.discount,
    discountAmount: row.discountAmount,
    taxes: row.taxes,
    amount: row.amount,
    balanceAfter: row.balanceAfter,
    voidReason: row.voidReason,
    shareToken: row.shareToken,
    snapshot: presentSnapshot(row.snapshot, currentlyPro),
    createdAt: row.createdAt.toISOString(),
  };
}
