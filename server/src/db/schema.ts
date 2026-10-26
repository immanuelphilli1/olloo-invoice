import type {
  AppliedTax,
  Discount,
  DocumentSnapshot,
  DocumentStyle,
  LineItem,
  TaxRate,
} from '@olloo/shared';
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const id = () => uuid('id').primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();
/** integer pesewas; bigint so totals above GH₵ 21m don't overflow */
const money = (name: string) => bigint(name, { mode: 'number' });

export const users = pgTable('users', {
  id: id(),
  name: text('name').notNull().default(''),
  email: text('email').unique(),
  phone: text('phone').unique(),
  passwordHash: text('password_hash'),
  isSuperadmin: boolean('is_superadmin').notNull().default(false),
  createdAt: createdAt(),
});

export const sessions = pgTable(
  'sessions',
  {
    /** sha256 of the cookie token — the raw token is never stored */
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)]
);

export const otpCodes = pgTable(
  'otp_codes',
  {
    id: id(),
    target: text('target').notNull(),
    codeHash: text('code_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('otp_target_idx').on(t.target, t.createdAt)]
);

export const passwordResets = pgTable('password_resets', {
  /** sha256 of the emailed token */
  id: text('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: createdAt(),
});

export const businesses = pgTable('businesses', {
  id: id(),
  /** owner-only accounts in v1: one business per user */
  ownerUserId: uuid('owner_user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  location: text('location').notNull().default(''),
  poBox: text('po_box').notNull().default(''),
  phone: text('phone').notNull().default(''),
  email: text('email').notNull().default(''),
  tin: text('tin').notNull().default(''),
  footerText: text('footer_text').notNull().default(''),
  logoKey: text('logo_key'),
  signatureKey: text('signature_key'),
  style: jsonb('style').$type<DocumentStyle>().notNull(),
  taxRates: jsonb('tax_rates').$type<TaxRate[]>().notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const counters = pgTable(
  'counters',
  {
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<'invoice' | 'receipt'>().notNull(),
    prefix: text('prefix').notNull(),
    nextNumber: integer('next_number').notNull().default(1),
    pad: integer('pad').notNull().default(4),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.kind] })]
);

export const files = pgTable('files', {
  /** random, unguessable — the URL /api/files/:key is the capability */
  key: text('key').primaryKey(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  kind: text('kind').$type<'logo' | 'signature'>().notNull(),
  mime: text('mime').notNull(),
  createdAt: createdAt(),
});

export const customers = pgTable(
  'customers',
  {
    id: id(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    address: text('address').notNull().default(''),
    phone: text('phone').notNull().default(''),
    email: text('email').notNull().default(''),
    createdAt: createdAt(),
  },
  (t) => [index('customers_business_idx').on(t.businessId, t.name)]
);

export const products = pgTable(
  'products',
  {
    id: id(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    unitPrice: money('unit_price'),
    archived: boolean('archived').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('products_business_idx').on(t.businessId, t.name)]
);

const customerColumns = () => ({
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  customerName: text('customer_name').notNull(),
  customerAddress: text('customer_address').notNull().default(''),
  customerPhone: text('customer_phone').notNull().default(''),
});

export const invoices = pgTable(
  'invoices',
  {
    id: id(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    number: text('number').notNull(),
    status: text('status').$type<'issued' | 'part_paid' | 'paid' | 'void'>().notNull().default('issued'),
    ...customerColumns(),
    lpoNo: text('lpo_no').notNull().default(''),
    date: date('date', { mode: 'string' }).notNull(),
    dueDate: date('due_date', { mode: 'string' }),
    items: jsonb('items').$type<LineItem[]>().notNull(),
    notes: text('notes').notNull().default(''),
    subtotal: money('subtotal').notNull(),
    discount: jsonb('discount').$type<Discount>().notNull(),
    discountAmount: money('discount_amount').notNull().default(0),
    taxes: jsonb('taxes').$type<AppliedTax[]>().notNull(),
    total: money('total').notNull(),
    amountPaid: money('amount_paid').notNull().default(0),
    voidReason: text('void_reason'),
    shareToken: text('share_token').unique(),
    snapshot: jsonb('snapshot').$type<DocumentSnapshot>().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('invoices_business_number_idx').on(t.businessId, t.number),
    index('invoices_business_date_idx').on(t.businessId, t.date),
  ]
);

export const receipts = pgTable(
  'receipts',
  {
    id: id(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    number: text('number').notNull(),
    status: text('status').$type<'issued' | 'void'>().notNull().default('issued'),
    layout: text('layout').$type<'classic' | 'itemized'>().notNull(),
    invoiceId: uuid('invoice_id').references(() => invoices.id),
    ...customerColumns(),
    date: date('date', { mode: 'string' }).notNull(),
    method: text('method').$type<'cash' | 'momo' | 'cheque' | 'bank' | 'card'>().notNull(),
    reference: text('reference').notNull().default(''),
    paymentFor: text('payment_for').notNull().default(''),
    items: jsonb('items').$type<LineItem[]>().notNull(),
    subtotal: money('subtotal').notNull(),
    discount: jsonb('discount').$type<Discount>().notNull(),
    discountAmount: money('discount_amount').notNull().default(0),
    taxes: jsonb('taxes').$type<AppliedTax[]>().notNull(),
    amount: money('amount').notNull(),
    balanceAfter: money('balance_after'),
    voidReason: text('void_reason'),
    shareToken: text('share_token').unique(),
    snapshot: jsonb('snapshot').$type<DocumentSnapshot>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('receipts_business_number_idx').on(t.businessId, t.number),
    index('receipts_business_date_idx').on(t.businessId, t.date),
    index('receipts_invoice_idx').on(t.invoiceId),
  ]
);

export const subscriptions = pgTable('subscriptions', {
  businessId: uuid('business_id')
    .primaryKey()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  interval: text('interval').$type<'monthly' | 'yearly'>(),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  /** complimentary Pro granted by a super-admin */
  comp: boolean('comp').notNull().default(false),
  billingEmail: text('billing_email'),
  paystackCustomerCode: text('paystack_customer_code'),
  paystackSubscriptionCode: text('paystack_subscription_code'),
  paystackEmailToken: text('paystack_email_token'),
  autoRenew: boolean('auto_renew').notNull().default(false),
  paymentFailed: boolean('payment_failed').notNull().default(false),
  lastReminderAt: timestamp('last_reminder_at', { withTimezone: true }),
  updatedAt: updatedAt(),
});

/** Processed Paystack events / charge references — makes webhook + verify idempotent. */
export const paystackEvents = pgTable('paystack_events', {
  id: text('id').primaryKey(),
  event: text('event').notNull(),
  payload: jsonb('payload').notNull(),
  createdAt: createdAt(),
});
