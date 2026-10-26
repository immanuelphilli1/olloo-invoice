/** Request bodies, validated on the server and used for typing in the web app. */
import { z } from 'zod';
import { ISO_DATE } from './dates';

const text = (max: number) => z.string().trim().max(max);
const isoDate = z.string().regex(ISO_DATE, 'Use YYYY-MM-DD');
const pesewas = z.number().int().safe();

export const lineItemSchema = z.object({
  qty: text(40).default(''),
  description: text(300),
  unitPrice: pesewas.nonnegative().nullable().default(null),
  amount: pesewas,
});

export const discountSchema = z.object({
  type: z.enum(['none', 'fixed', 'percent']),
  value: z.number().int().nonnegative(),
});

const customerFields = {
  customerId: z.string().nullable().default(null),
  customerName: text(200).min(1, 'Customer name is required'),
  customerAddress: text(300).default(''),
  customerPhone: text(30).default(''),
};

const items = z
  .array(lineItemSchema)
  .max(200)
  .transform((list) => list.filter((i) => i.description !== ''))
  .refine((list) => list.length > 0, 'Add at least one line item');

export const invoiceInputSchema = z.object({
  ...customerFields,
  lpoNo: text(60).default(''),
  date: isoDate,
  dueDate: isoDate.nullable().default(null),
  items,
  notes: text(1000).default(''),
  discount: discountSchema.default({ type: 'none', value: 0 }),
});
export type InvoiceInput = z.input<typeof invoiceInputSchema>;

const paymentMethod = z.enum(['cash', 'momo', 'cheque', 'bank', 'card']);

export const paymentInputSchema = z.object({
  amount: pesewas.positive('Amount must be more than zero'),
  date: isoDate,
  method: paymentMethod,
  reference: text(100).default(''),
  paymentFor: text(300).default(''),
});
export type PaymentInput = z.input<typeof paymentInputSchema>;

export const receiptInputSchema = z.discriminatedUnion('layout', [
  z.object({
    layout: z.literal('classic'),
    ...customerFields,
    date: isoDate,
    amount: pesewas.positive('Amount must be more than zero'),
    method: paymentMethod,
    reference: text(100).default(''),
    paymentFor: text(300).default(''),
  }),
  z.object({
    layout: z.literal('itemized'),
    ...customerFields,
    date: isoDate,
    items,
    discount: discountSchema.default({ type: 'none', value: 0 }),
    method: paymentMethod,
    reference: text(100).default(''),
    paymentFor: text(300).default(''),
  }),
]);
export type ReceiptInput = z.input<typeof receiptInputSchema>;

export const voidSchema = z.object({ reason: text(300).min(1, 'Give a reason') });

export const businessInputSchema = z.object({
  name: text(120).min(1, 'Business name is required'),
  location: text(200).default(''),
  poBox: text(120).default(''),
  phone: text(60).default(''),
  email: text(120).default(''),
  tin: text(40).default(''),
  footerText: text(200).default(''),
});
export type BusinessInput = z.input<typeof businessInputSchema>;

export const taxRatesSchema = z
  .array(
    z.object({
      id: text(40).min(1),
      name: text(40).min(1),
      rateBps: z.number().int().min(0).max(10_000),
      enabled: z.boolean(),
    })
  )
  .max(8);

const counterSchema = z.object({
  prefix: z.string().max(12).regex(/^[A-Za-z0-9/_-]*$/, 'Letters, numbers, - / _ only'),
  nextNumber: z.number().int().min(1).max(99_999_999),
  pad: z.number().int().min(1).max(10),
});
export const countersSchema = z.object({ invoice: counterSchema, receipt: counterSchema });

export const customerInputSchema = z.object({
  name: text(200).min(1, 'Name is required'),
  address: text(300).default(''),
  phone: text(30).default(''),
  email: text(120).default(''),
});
export type CustomerInput = z.input<typeof customerInputSchema>;

export const productInputSchema = z.object({
  name: text(300).min(1, 'Name is required'),
  unitPrice: pesewas.nonnegative().nullable().default(null),
  archived: z.boolean().default(false),
});
export type ProductInput = z.input<typeof productInputSchema>;

export const otpRequestSchema = z.object({ phone: text(30).min(1) });
export const otpVerifySchema = z.object({
  phone: text(30).min(1),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  name: text(120).optional(),
});
export const passwordSignupSchema = z.object({
  name: text(120).min(1, 'Your name is required'),
  email: z.email().max(200),
  password: z.string().min(8, 'At least 8 characters').max(200),
});
export const passwordLoginSchema = z.object({
  email: z.email().max(200),
  password: z.string().min(1).max(200),
});
export const resetRequestSchema = z.object({ email: z.email().max(200) });
export const resetConfirmSchema = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(8, 'At least 8 characters').max(200),
});

export const checkoutSchema = z.object({
  interval: z.enum(['monthly', 'yearly']),
  /** required when the account has no email (phone sign-up); Paystack needs one */
  email: z.email().max(200).optional(),
});
