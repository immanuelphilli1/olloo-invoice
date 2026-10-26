import type { Pesewas } from './money';

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion'];

/** 0–999 in British style: "one hundred and five". */
function underThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${ONES[hundreds]} hundred`);
  if (rest) {
    const restWords =
      rest < 20
        ? ONES[rest]!
        : TENS[Math.floor(rest / 10)]! + (rest % 10 ? `-${ONES[rest % 10]}` : '');
    parts.push(hundreds ? `and ${restWords}` : restWords);
  }
  return parts.join(' ');
}

/** Non-negative integer to words: 1250 → "one thousand two hundred and fifty". */
export function integerToWords(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError(`Cannot spell ${n}`);
  if (n === 0) return ONES[0]!;

  const groups: number[] = [];
  for (let rest = n; rest > 0; rest = Math.floor(rest / 1000)) groups.push(rest % 1000);
  if (groups.length > SCALES.length) throw new RangeError(`Cannot spell ${n}`);

  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i]!;
    if (!g) continue;
    // "one million and five" — British "and" before a trailing group under 100
    if (i === 0 && parts.length > 0 && g < 100) parts.push('and');
    parts.push(underThousand(g) + (SCALES[i] ? ` ${SCALES[i]}` : ''));
  }
  return parts.join(' ');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Amount for the "the sum of" line on a receipt.
 * 50050 → "Five hundred Ghana cedis and fifty pesewas"
 */
export function amountInWords(p: Pesewas): string {
  const abs = Math.abs(Math.round(p));
  const cedis = Math.floor(abs / 100);
  const pesewas = abs % 100;

  const cediPart = `${integerToWords(cedis)} Ghana ${cedis === 1 ? 'cedi' : 'cedis'}`;
  const pesewaPart = `${integerToWords(pesewas)} ${pesewas === 1 ? 'pesewa' : 'pesewas'}`;

  let words: string;
  if (cedis && pesewas) words = `${cediPart} and ${pesewaPart}`;
  else if (pesewas) words = pesewaPart;
  else words = cediPart;

  return capitalize(p < 0 ? `minus ${words}` : words);
}
