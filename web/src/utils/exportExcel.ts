import { formatDisplayDate, PAYMENT_METHODS, type Invoice, type Receipt } from '@olloo/shared';

const cedis = (p: number) => Math.round(p) / 100;

const STATUS_LABEL: Record<Invoice['status'], string> = {
  issued: 'Unpaid',
  part_paid: 'Part-paid',
  paid: 'Paid',
  void: 'Void',
};

async function writeSheet(rows: Record<string, unknown>[], sheetName: string, filename: string) {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

export function exportInvoicesToExcel(invoices: Invoice[], filename: string) {
  return writeSheet(
    invoices.map((i) => ({
      Number: i.number,
      Date: formatDisplayDate(i.date),
      Customer: i.customerName,
      Address: i.customerAddress,
      Phone: i.customerPhone,
      'L.P.O. No.': i.lpoNo,
      Status: STATUS_LABEL[i.status],
      'Sub-total (GH₵)': cedis(i.subtotal),
      'Discount (GH₵)': cedis(i.discountAmount),
      'Tax (GH₵)': cedis(i.taxes.reduce((s, t) => s + t.amount, 0)),
      'Total (GH₵)': cedis(i.total),
      'Paid (GH₵)': cedis(i.amountPaid),
      'Balance (GH₵)': cedis(i.balance),
      'Void reason': i.voidReason ?? '',
    })),
    'Invoices',
    filename
  );
}

export function exportReceiptsToExcel(receipts: Receipt[], filename: string) {
  return writeSheet(
    receipts.map((r) => ({
      Number: r.number,
      Date: formatDisplayDate(r.date),
      Customer: r.customerName,
      'Amount (GH₵)': cedis(r.amount),
      Method: PAYMENT_METHODS.find((m) => m.id === r.method)?.label ?? r.method,
      Reference: r.reference,
      'Payment for': r.paymentFor,
      Invoice: r.invoiceNumber ?? '',
      'Balance after (GH₵)': r.balanceAfter == null ? '' : cedis(r.balanceAfter),
      Status: r.status === 'void' ? 'Void' : 'Issued',
      'Void reason': r.voidReason ?? '',
    })),
    'Receipts',
    filename
  );
}
