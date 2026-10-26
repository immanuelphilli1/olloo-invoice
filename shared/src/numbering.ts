export type DocKind = 'invoice' | 'receipt';

export const DEFAULT_PREFIX: Record<DocKind, string> = {
  invoice: 'INV-',
  receipt: 'RCT-',
};

export const DEFAULT_PAD = 4;

/** formatDocNumber('INV-', 7, 4) → "INV-0007" */
export function formatDocNumber(prefix: string, n: number, pad = DEFAULT_PAD): string {
  return `${prefix}${String(n).padStart(pad, '0')}`;
}
