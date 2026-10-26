/** All money is stored and computed as integer pesewas (GH₵ 1 = 100 pesewas). */
export type Pesewas = number;

/** Round to the nearest integer, halves away from zero (so -2.5 → -3, not -2). */
export function roundHalfUp(n: number): number {
  return Math.sign(n) * Math.round(Math.abs(n));
}

/**
 * Parse a cedi amount ("12.5", 12.5, "1,200.05", "-3") into pesewas.
 * Works on the decimal string so 1.005 becomes 101, not 100 (float drift).
 * Returns null for blank or invalid input.
 */
export function toPesewas(input: string | number | null | undefined): Pesewas | null {
  if (input == null) return null;
  let s: string;
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null;
    s = String(input);
    if (/e/i.test(s)) s = input.toFixed(6);
  } else {
    s = input.replace(/[,\s]/g, '');
  }
  if (s === '') return null;

  const m = /^([+-])?(\d*)(?:\.(\d*))?$/.exec(s);
  if (!m) return null;
  const [, sign, wholeDigits = '', fracDigits = ''] = m;
  if (wholeDigits === '' && fracDigits === '') return null;

  const frac = fracDigits.padEnd(3, '0');
  let p = Number(wholeDigits || '0') * 100 + Number(frac.slice(0, 2));
  if (Number(frac[2]) >= 5) p += 1;
  if (!Number.isSafeInteger(p)) return null;
  return sign === '-' ? -p : p;
}

/** "1,234.50" (no currency symbol), formatted without relying on runtime locale data. */
export function formatCedi(p: Pesewas): string {
  const neg = p < 0;
  const abs = Math.abs(Math.round(p));
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const cents = String(abs % 100).padStart(2, '0');
  return `${neg ? '-' : ''}${whole}.${cents}`;
}

/** "GH₵ 1,234.50" */
export function formatGhs(p: Pesewas): string {
  return `GH₵ ${formatCedi(p)}`;
}

/** Split for the ledger-style ₵ | Gp columns. */
export function splitAmount(p: Pesewas): { whole: string; cents: string } {
  const [whole = '0', cents = '00'] = formatCedi(p).split('.');
  return { whole, cents };
}

/** Pesewas → value for a text input ("12.50"), blank for null. */
export function pesewasToInput(p: Pesewas | null | undefined): string {
  if (p == null) return '';
  return formatCedi(p).replace(/,/g, '');
}
