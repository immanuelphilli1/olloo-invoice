import { roundHalfUp, type Pesewas } from './money';
import type { AppliedTax, Discount, LineItem, TaxRate } from './types';

export interface Totals {
  subtotal: Pesewas;
  discountAmount: Pesewas;
  /** subtotal − discount; every tax is charged on this base (not compounded) */
  taxableBase: Pesewas;
  taxes: AppliedTax[];
  total: Pesewas;
}

export function sumItems(items: Pick<LineItem, 'amount'>[]): Pesewas {
  return items.reduce((sum, item) => sum + (item.amount || 0), 0);
}

export function discountAmount(subtotal: Pesewas, discount: Discount): Pesewas {
  if (subtotal <= 0) return 0;
  switch (discount.type) {
    case 'fixed':
      return Math.min(Math.max(discount.value, 0), subtotal);
    case 'percent': {
      const bps = Math.min(Math.max(discount.value, 0), 10_000);
      return roundHalfUp((subtotal * bps) / 10_000);
    }
    default:
      return 0;
  }
}

/**
 * subtotal → discount → each enabled tax on the discounted base → total.
 * The server recomputes this on every save; client numbers are only a preview.
 */
export function computeTotals(
  items: Pick<LineItem, 'amount'>[],
  discount: Discount,
  taxRates: Pick<TaxRate, 'name' | 'rateBps'>[]
): Totals {
  const subtotal = sumItems(items);
  const discountAmt = discountAmount(subtotal, discount);
  const taxableBase = subtotal - discountAmt;
  const taxes = taxRates.map((t) => ({
    name: t.name,
    rateBps: t.rateBps,
    amount: taxableBase > 0 ? roundHalfUp((taxableBase * t.rateBps) / 10_000) : 0,
  }));
  const total = taxableBase + taxes.reduce((s, t) => s + t.amount, 0);
  return { subtotal, discountAmount: discountAmt, taxableBase, taxes, total };
}

/** 1250 bps → "12.5%" */
export function formatRate(bps: number): string {
  return `${(bps / 100).toFixed(2).replace(/\.?0+$/, '')}%`;
}
