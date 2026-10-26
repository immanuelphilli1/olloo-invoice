import { describe, expect, it } from 'vitest';
import {
  addMonthsUtc,
  amountInWords,
  computeTotals,
  effectiveStyle,
  entitlementsFor,
  extendPeriod,
  formatCedi,
  formatDocNumber,
  formatRate,
  integerToWords,
  invoiceInputSchema,
  isPro,
  monthStart,
  normalizePhone,
  receiptStyle,
  sanitizeStyle,
  usesProTemplates,
  splitAmount,
  TEMPLATES,
  toPesewas,
} from './index';

describe('money', () => {
  it('parses cedi strings and numbers to pesewas without float drift', () => {
    expect(toPesewas('12.5')).toBe(1250);
    expect(toPesewas('1,200.05')).toBe(120005);
    expect(toPesewas(1.005)).toBe(101);
    expect(toPesewas('0.105')).toBe(11);
    expect(toPesewas('-3')).toBe(-300);
    expect(toPesewas('.5')).toBe(50);
    expect(toPesewas('')).toBeNull();
    expect(toPesewas('abc')).toBeNull();
    expect(toPesewas('-')).toBeNull();
    expect(toPesewas(Number.NaN)).toBeNull();
  });

  it('formats with thousands separators and splits for ledger columns', () => {
    expect(formatCedi(0)).toBe('0.00');
    expect(formatCedi(5)).toBe('0.05');
    expect(formatCedi(123456789)).toBe('1,234,567.89');
    expect(formatCedi(-1050)).toBe('-10.50');
    expect(splitAmount(120005)).toEqual({ whole: '1,200', cents: '05' });
  });
});

describe('totals', () => {
  const items = [{ amount: 10000 }, { amount: 5050 }];

  it('sums with no discount or tax', () => {
    const t = computeTotals(items, { type: 'none', value: 0 }, []);
    expect(t).toMatchObject({ subtotal: 15050, discountAmount: 0, taxableBase: 15050, total: 15050 });
  });

  it('applies percent discount then taxes on the discounted base', () => {
    const t = computeTotals(items, { type: 'percent', value: 1000 }, [
      { name: 'VAT', rateBps: 1500 },
      { name: 'NHIL', rateBps: 250 },
    ]);
    expect(t.discountAmount).toBe(1505);
    expect(t.taxableBase).toBe(13545);
    expect(t.taxes.map((x) => x.amount)).toEqual([2032, 339]); // 2031.75 → 2032, 338.625 → 339
    expect(t.total).toBe(13545 + 2032 + 339);
  });

  it('caps a fixed discount at the subtotal', () => {
    const t = computeTotals(items, { type: 'fixed', value: 999999 }, [{ name: 'VAT', rateBps: 1500 }]);
    expect(t.discountAmount).toBe(15050);
    expect(t.total).toBe(0);
  });

  it('formats rates', () => {
    expect(formatRate(1500)).toBe('15%');
    expect(formatRate(250)).toBe('2.5%');
    expect(formatRate(1250)).toBe('12.5%');
  });
});

describe('amountInWords', () => {
  it('spells integers in British style', () => {
    expect(integerToWords(0)).toBe('zero');
    expect(integerToWords(105)).toBe('one hundred and five');
    expect(integerToWords(1250)).toBe('one thousand two hundred and fifty');
    expect(integerToWords(1_000_005)).toBe('one million and five');
    expect(integerToWords(21)).toBe('twenty-one');
  });

  it('spells cedis and pesewas', () => {
    expect(amountInWords(0)).toBe('Zero Ghana cedis');
    expect(amountInWords(1)).toBe('One pesewa');
    expect(amountInWords(100)).toBe('One Ghana cedi');
    expect(amountInWords(50050)).toBe('Five hundred Ghana cedis and fifty pesewas');
    expect(amountInWords(100_000_000)).toBe('One million Ghana cedis');
  });
});

describe('plans', () => {
  const now = new Date('2026-03-15T10:00:00Z');

  it('is pro while the period has not ended, or when comped', () => {
    expect(isPro(null, now)).toBe(false);
    expect(isPro({ comp: false, currentPeriodEnd: null }, now)).toBe(false);
    expect(isPro({ comp: false, currentPeriodEnd: '2026-03-16T00:00:00Z' }, now)).toBe(true);
    expect(isPro({ comp: false, currentPeriodEnd: '2026-03-14T00:00:00Z' }, now)).toBe(false);
    expect(isPro({ comp: true, currentPeriodEnd: null }, now)).toBe(true);
  });

  it('gives free accounts the limit and watermark', () => {
    expect(entitlementsFor(false)).toMatchObject({ monthlyDocLimit: 10, watermark: true, templates: false });
    expect(entitlementsFor(true)).toMatchObject({ monthlyDocLimit: null, watermark: false, publicLinks: true });
  });

  it('finds the month start (Accra = UTC)', () => {
    expect(monthStart(new Date('2026-03-31T23:59:59Z')).toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(monthStart(new Date('2026-04-01T00:00:00Z')).toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });

  it('extends from the later of now and the current end, clamping month ends', () => {
    expect(addMonthsUtc(new Date('2026-01-31T00:00:00Z'), 1).toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(extendPeriod(null, 'monthly', now).toISOString()).toBe('2026-04-15T10:00:00.000Z');
    expect(extendPeriod(new Date('2026-03-20T00:00:00Z'), 'monthly', now).toISOString()).toBe(
      '2026-04-20T00:00:00.000Z'
    );
    expect(extendPeriod(new Date('2026-01-01T00:00:00Z'), 'yearly', now).toISOString()).toBe(
      '2027-03-15T10:00:00.000Z'
    );
  });
});

describe('style', () => {
  it('sanitizes untrusted input field by field', () => {
    const s = sanitizeStyle({ template: 'modern', accent: 'red', ink: '#ABCDEF', rowsPerPage: 99, bodyFont: 'Comic Sans' });
    expect(s.template).toBe('modern');
    expect(s.accent).toBe(TEMPLATES['classic-ink'].preset.accent);
    expect(s.ink).toBe('#abcdef');
    expect(s.rowsPerPage).toBe(25);
    expect(s.bodyFont).toBe(TEMPLATES['classic-ink'].preset.bodyFont);
  });

  it('forces Classic Ink and Receipt Book when templates are not allowed', () => {
    const modern = TEMPLATES.modern.preset;
    expect(effectiveStyle(modern, false)).toMatchObject({ template: 'classic-ink', receiptTemplate: 'receipt-book' });
    expect(effectiveStyle(modern, true).template).toBe('modern');
    const classicWithTill = { ...TEMPLATES['classic-ink'].preset, receiptTemplate: 'till' as const, ink: '#123456' };
    expect(effectiveStyle(classicWithTill, false)).toMatchObject({ receiptTemplate: 'receipt-book', ink: '#123456' });
    expect(usesProTemplates(classicWithTill)).toBe(true);
    expect(usesProTemplates(TEMPLATES['classic-ink'].preset)).toBe(false);
  });

  it('keeps own colours for a same-family receipt template, uses the preset otherwise', () => {
    const custom = { ...TEMPLATES.modern.preset, accent: '#aa0000', fontScale: 'lg' as const };
    expect(receiptStyle({ ...custom, receiptTemplate: 'modern' }).accent).toBe('#aa0000');
    const till = receiptStyle({ ...custom, receiptTemplate: 'till' });
    expect(till).toMatchObject({ template: 'minimal', receiptTemplate: 'till', bodyFont: 'IBM Plex Mono', fontScale: 'lg' });
    // older snapshots have no receiptTemplate
    const legacy = { ...TEMPLATES['classic-ink'].preset } as Partial<typeof custom>;
    delete legacy.receiptTemplate;
    expect(receiptStyle(legacy as typeof custom).receiptTemplate).toBe('receipt-book');
    expect(sanitizeStyle(legacy).receiptTemplate).toBe('receipt-book');
    expect(sanitizeStyle({ receiptTemplate: 'till' }).receiptTemplate).toBe('till');
    expect(sanitizeStyle({ receiptTemplate: 'nope' }).receiptTemplate).toBe('receipt-book');
  });
});

describe('misc', () => {
  it('formats document numbers', () => {
    expect(formatDocNumber('INV-', 7)).toBe('INV-0007');
    expect(formatDocNumber('', 130, 7)).toBe('0000130');
  });

  it('normalizes Ghana phone numbers', () => {
    expect(normalizePhone('024 123 4567')).toBe('+233241234567');
    expect(normalizePhone('+233 24 123 4567')).toBe('+233241234567');
    expect(normalizePhone('233241234567')).toBe('+233241234567');
    expect(normalizePhone('12345')).toBeNull();
  });

  it('drops blank line items and requires at least one', () => {
    const base = { customerName: 'Kofi', date: '2026-03-01' };
    const ok = invoiceInputSchema.parse({
      ...base,
      items: [{ description: 'Cement', amount: 9000 }, { description: '', amount: 0 }],
    });
    expect(ok.items).toHaveLength(1);
    expect(() => invoiceInputSchema.parse({ ...base, items: [{ description: '', amount: 0 }] })).toThrow();
  });
});
