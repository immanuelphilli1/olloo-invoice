import { effectiveStyle, PAYMENT_METHODS, TEMPLATES, type DocumentSnapshot, type DocumentStyle, type PaymentMethod } from '@olloo/shared';
import type { Account } from '../lib/session';

export function isHandwritten(style: DocumentStyle) {
  return TEMPLATES[style.template].handwritten;
}

/** "Mobile Money · Ref 123" */
export function paymentLine(method: PaymentMethod, reference: string): string {
  const label = PAYMENT_METHODS.find((m) => m.id === method)?.label ?? method;
  return reference ? `${label} · Ref ${reference}` : label;
}

/** What a new document will look like right now (mirrors the server's buildSnapshot). */
export function previewSnapshot(account: Account, styleOverride?: DocumentStyle): DocumentSnapshot {
  const b = account.business;
  return {
    company: {
      name: b.name,
      location: b.location,
      poBox: b.poBox,
      phone: b.phone,
      email: b.email,
      tin: b.tin,
      footerText: b.footerText,
      logoUrl: b.logoUrl,
      signatureUrl: b.signatureUrl,
    },
    style: styleOverride ?? effectiveStyle(b.style, account.entitlements.templates),
    watermark: account.entitlements.watermark,
  };
}
