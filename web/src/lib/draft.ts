import {
  pesewasToInput,
  roundHalfUp,
  toPesewas,
  type Discount,
  type DiscountType,
  type LineItem,
} from '@olloo/shared';

/** Line item as typed in the form: strings, so half-typed numbers ("12.") survive. */
export interface DraftItem {
  qty: string;
  description: string;
  unitPrice: string;
  amount: string;
  /** amount follows qty × unit price until the user types an amount themselves */
  auto: boolean;
}

export const emptyItem = (): DraftItem => ({ qty: '', description: '', unitPrice: '', amount: '', auto: true });

export const blankItems = () => [emptyItem(), emptyItem(), emptyItem()];

/** Leading number of a free-text qty: "3 bags" → 3, "1.5" → 1.5, "dozen" → null. */
export function parseQty(qty: string): number | null {
  const m = /^\s*(\d+(?:\.\d+)?)/.exec(qty);
  return m ? Number(m[1]) : null;
}

/** Apply a change to one row, keeping the auto amount in step. */
export function updateItem(item: DraftItem, patch: Partial<DraftItem>): DraftItem {
  const next = { ...item, ...patch };
  if ('amount' in patch) next.auto = patch.amount === '';
  if (next.auto) {
    const qty = parseQty(next.qty);
    const unit = toPesewas(next.unitPrice);
    next.amount = qty != null && unit != null ? pesewasToInput(roundHalfUp(qty * unit)) : '';
  }
  return next;
}

export function toLineItems(items: DraftItem[]): LineItem[] {
  return items
    .filter((i) => i.description.trim() || toPesewas(i.amount))
    .map((i) => ({
      qty: i.qty.trim(),
      description: i.description.trim(),
      unitPrice: toPesewas(i.unitPrice),
      amount: toPesewas(i.amount) ?? 0,
    }));
}

export function fromLineItems(items: LineItem[]): DraftItem[] {
  if (!items.length) return blankItems();
  return items.map((i) => {
    const amount = pesewasToInput(i.amount);
    const draft: DraftItem = { qty: i.qty, description: i.description, unitPrice: pesewasToInput(i.unitPrice), amount, auto: false };
    // Keep auto-calculation on when the saved amount is exactly qty × price.
    return updateItem(draft, {}).amount === amount ? { ...draft, auto: true } : draft;
  });
}

export interface DraftDiscount {
  type: DiscountType;
  /** cedis for fixed, percent for percent */
  value: string;
}

export function toDiscount(d: DraftDiscount): Discount {
  if (d.type === 'fixed') return { type: 'fixed', value: Math.max(toPesewas(d.value) ?? 0, 0) };
  // percent: "12.5" → 1250 basis points (same parser: 2 decimals)
  if (d.type === 'percent') return { type: 'percent', value: Math.min(Math.max(toPesewas(d.value) ?? 0, 0), 10_000) };
  return { type: 'none', value: 0 };
}

export function fromDiscount(d: Discount): DraftDiscount {
  if (d.type === 'none') return { type: 'none', value: '' };
  return { type: d.type, value: pesewasToInput(d.value).replace(/\.00$/, '') };
}
