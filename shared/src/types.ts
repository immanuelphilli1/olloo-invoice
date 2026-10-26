import type { Pesewas } from './money';
import type { BillingInterval, Entitlements, PlanId } from './plans';
import type { DocumentStyle } from './style';

export interface LineItem {
  /** free text, e.g. "2" or "3 bags" — as on paper invoices */
  qty: string;
  description: string;
  unitPrice: Pesewas | null;
  /** entered per line; may be negative for credits */
  amount: Pesewas;
}

export type DiscountType = 'none' | 'fixed' | 'percent';

export interface Discount {
  type: DiscountType;
  /** fixed: pesewas · percent: basis points (1250 = 12.5%) */
  value: number;
}

export const NO_DISCOUNT: Discount = { type: 'none', value: 0 };

export interface TaxRate {
  id: string;
  name: string;
  rateBps: number;
  enabled: boolean;
}

export interface AppliedTax {
  name: string;
  rateBps: number;
  amount: Pesewas;
}

export interface CompanyInfo {
  name: string;
  location: string;
  poBox: string;
  phone: string;
  email: string;
  tin: string;
  footerText: string;
  logoUrl: string | null;
  signatureUrl: string | null;
}

/** Frozen at issue time so later branding changes never alter an issued document. */
export interface DocumentSnapshot {
  company: CompanyInfo;
  style: DocumentStyle;
  watermark: boolean;
}

export type InvoiceStatus = 'issued' | 'part_paid' | 'paid' | 'void';
export type ReceiptStatus = 'issued' | 'void';
export type ReceiptLayout = 'classic' | 'itemized';
export type PaymentMethod = 'cash' | 'momo' | 'cheque' | 'bank' | 'card';

export const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'momo', label: 'Mobile Money' },
  { id: 'cheque', label: 'Cheque' },
  { id: 'bank', label: 'Bank transfer' },
  { id: 'card', label: 'Card' },
];

export interface CustomerFields {
  customerId: string | null;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
}

export interface Invoice extends CustomerFields {
  id: string;
  number: string;
  status: InvoiceStatus;
  lpoNo: string;
  date: string;
  dueDate: string | null;
  items: LineItem[];
  notes: string;
  subtotal: Pesewas;
  discount: Discount;
  discountAmount: Pesewas;
  taxes: AppliedTax[];
  total: Pesewas;
  amountPaid: Pesewas;
  balance: Pesewas;
  voidReason: string | null;
  shareToken: string | null;
  snapshot: DocumentSnapshot;
  createdAt: string;
  updatedAt: string;
}

export interface Receipt extends CustomerFields {
  id: string;
  number: string;
  status: ReceiptStatus;
  layout: ReceiptLayout;
  invoiceId: string | null;
  invoiceNumber: string | null;
  date: string;
  method: PaymentMethod;
  reference: string;
  paymentFor: string;
  /** itemized layout only */
  items: LineItem[];
  subtotal: Pesewas;
  discount: Discount;
  discountAmount: Pesewas;
  taxes: AppliedTax[];
  amount: Pesewas;
  /** invoice balance after this payment; null for standalone receipts */
  balanceAfter: Pesewas | null;
  voidReason: string | null;
  shareToken: string | null;
  snapshot: DocumentSnapshot;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
}

export interface Product {
  id: string;
  name: string;
  unitPrice: Pesewas | null;
  archived: boolean;
}

export interface CounterSettings {
  prefix: string;
  nextNumber: number;
  pad: number;
}

export interface Business {
  id: string;
  name: string;
  location: string;
  poBox: string;
  phone: string;
  email: string;
  tin: string;
  footerText: string;
  logoUrl: string | null;
  signatureUrl: string | null;
  style: DocumentStyle;
  taxRates: TaxRate[];
  counters: { invoice: CounterSettings; receipt: CounterSettings };
}

export interface User {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isSuperadmin: boolean;
}

export interface SubscriptionInfo {
  plan: PlanId;
  interval: BillingInterval | null;
  currentPeriodEnd: string | null;
  comp: boolean;
  /** card subscription that Paystack will charge again */
  autoRenew: boolean;
  paymentFailed: boolean;
}

export interface Me {
  user: User;
  business: Business | null;
  subscription: SubscriptionInfo;
  entitlements: Entitlements;
  usage: { docsThisMonth: number };
}

export interface DashboardSummary {
  billedThisMonth: Pesewas;
  collectedThisMonth: Pesewas;
  outstanding: Pesewas;
  unpaidCount: number;
  recent: Array<{
    kind: 'invoice' | 'receipt';
    id: string;
    number: string;
    customerName: string;
    date: string;
    amount: Pesewas;
    status: InvoiceStatus | ReceiptStatus;
  }>;
}

export interface PublicDocument {
  kind: 'invoice' | 'receipt';
  invoice?: Invoice;
  receipt?: Receipt;
}

export interface ApiError {
  error: string;
  code?: 'limit_reached' | 'pro_required' | 'unauthenticated' | 'not_found' | 'invalid';
}
