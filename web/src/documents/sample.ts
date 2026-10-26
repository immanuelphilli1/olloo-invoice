import {
  computeTotals,
  todayIso,
  type DocumentSnapshot,
  type LineItem,
  type Receipt,
  type ReceiptLayout,
} from '@olloo/shared';
import type { ItemsDocumentProps } from './ItemsDocument';

const SAMPLE_ITEMS: LineItem[] = [
  { qty: '4', description: 'Cement (50kg bag)', unitPrice: 9500, amount: 38000 },
  { qty: '2', description: 'Iron rods 12mm', unitPrice: 12000, amount: 24000 },
  { qty: '1', description: 'Delivery to site', unitPrice: null, amount: 5000 },
];

/** A believable invoice for template previews in onboarding and Settings → Branding. */
export function sampleInvoiceProps(snapshot: DocumentSnapshot): ItemsDocumentProps {
  const totals = computeTotals(SAMPLE_ITEMS, { type: 'none', value: 0 }, []);
  return {
    kind: 'invoice',
    snapshot,
    number: 'INV-0042',
    customerName: 'Kofi Mensah',
    customerAddress: 'Adum, Kumasi',
    customerPhone: '024 123 4567',
    lpoNo: 'LPO-118',
    date: todayIso(),
    items: SAMPLE_ITEMS,
    subtotal: totals.subtotal,
    discount: { type: 'none', value: 0 },
    discountAmount: 0,
    taxes: [],
    total: totals.total,
    showTotalStamp: true,
  };
}

/** Sample receipt: a part payment against an invoice (classic) or a shop sale (itemized). */
export function sampleReceipt(snapshot: DocumentSnapshot, layout: ReceiptLayout): Receipt {
  const itemized = layout === 'itemized';
  const items = itemized ? SAMPLE_ITEMS.slice(0, 2) : [];
  const amount = itemized ? computeTotals(items, { type: 'none', value: 0 }, []).total : 40000;
  return {
    id: 'sample',
    number: 'RCT-0017',
    status: 'issued',
    layout,
    invoiceId: itemized ? null : 'sample-invoice',
    invoiceNumber: itemized ? null : 'INV-0042',
    customerId: null,
    customerName: itemized ? 'Walk-in customer' : 'Kofi Mensah',
    customerAddress: '',
    customerPhone: '',
    date: todayIso(),
    method: 'momo',
    reference: 'MP261026.1452',
    paymentFor: itemized ? '' : 'Part payment for invoice № INV-0042',
    items,
    subtotal: amount,
    discount: { type: 'none', value: 0 },
    discountAmount: 0,
    taxes: [],
    amount,
    balanceAfter: itemized ? null : 27000,
    voidReason: null,
    shareToken: null,
    snapshot,
    createdAt: new Date().toISOString(),
  };
}
