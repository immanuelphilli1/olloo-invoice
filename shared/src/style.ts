export type TemplateId = 'classic-ink' | 'modern' | 'minimal';
export type ReceiptTemplateId = 'receipt-book' | 'modern' | 'minimal' | 'till';
export type FontScale = 'sm' | 'md' | 'lg';

export interface DocumentStyle {
  /** invoice template; colours and fonts below belong to it */
  template: TemplateId;
  /** receipts are chosen separately (documents issued before this existed have none → receipt-book) */
  receiptTemplate: ReceiptTemplateId;
  /** rules, headings, total box */
  accent: string;
  /** colour of filled-in values */
  ink: string;
  /** sheet background */
  paper: string;
  /** shaded amount columns */
  shade: string;
  headingFont: string;
  bodyFont: string;
  /** font for filled-in values (handwriting on Classic Ink) */
  inkFont: string;
  fontScale: FontScale;
  rowsPerPage: number;
}

export interface FontOption {
  family: string;
  /** CSS font-family stack */
  css: string;
  /** Google Fonts css2 `family=` value */
  google: string;
}

export const FONT_OPTIONS: FontOption[] = [
  { family: 'Libre Baskerville', css: '"Libre Baskerville", "Times New Roman", serif', google: 'Libre+Baskerville:ital,wght@0,400;0,700;1,400' },
  { family: 'Caveat', css: '"Caveat", cursive', google: 'Caveat:wght@500;600' },
  { family: 'Kalam', css: '"Kalam", cursive', google: 'Kalam:wght@400;700' },
  { family: 'DM Sans', css: '"DM Sans", system-ui, sans-serif', google: 'DM+Sans:wght@400;500;700' },
  { family: 'Inter', css: '"Inter", system-ui, sans-serif', google: 'Inter:wght@400;500;700' },
  { family: 'Poppins', css: '"Poppins", system-ui, sans-serif', google: 'Poppins:wght@400;500;700' },
  { family: 'Playfair Display', css: '"Playfair Display", Georgia, serif', google: 'Playfair+Display:wght@400;700' },
  { family: 'Merriweather', css: '"Merriweather", Georgia, serif', google: 'Merriweather:wght@400;700' },
  { family: 'IBM Plex Mono', css: '"IBM Plex Mono", ui-monospace, monospace', google: 'IBM+Plex+Mono:wght@400;600' },
];

export function fontCss(family: string): string {
  return FONT_OPTIONS.find((f) => f.family === family)?.css ?? FONT_OPTIONS[0]!.css;
}

export interface TemplateInfo {
  id: TemplateId;
  name: string;
  description: string;
  /** values written in a handwriting-sized ink font on ruled lines */
  handwritten: boolean;
  preset: DocumentStyle;
}

export const TEMPLATES: Record<TemplateId, TemplateInfo> = {
  'classic-ink': {
    id: 'classic-ink',
    name: 'Classic Ink',
    description: 'Cream paper, ruled lines and blue handwriting — like a receipt book.',
    handwritten: true,
    preset: {
      template: 'classic-ink',
      receiptTemplate: 'receipt-book',
      accent: '#000000',
      ink: '#1a3a8a',
      paper: '#f7f3e8',
      shade: '#eceae0',
      headingFont: 'Libre Baskerville',
      bodyFont: 'Libre Baskerville',
      inkFont: 'Caveat',
      fontScale: 'md',
      rowsPerPage: 13,
    },
  },
  modern: {
    id: 'modern',
    name: 'Clean Modern',
    description: 'White page, coloured accents and a crisp sans-serif.',
    handwritten: false,
    preset: {
      template: 'modern',
      receiptTemplate: 'modern',
      accent: '#0f766e',
      ink: '#0f172a',
      paper: '#ffffff',
      shade: '#f1f5f9',
      headingFont: 'Poppins',
      bodyFont: 'Inter',
      inkFont: 'Inter',
      fontScale: 'md',
      rowsPerPage: 15,
    },
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal Mono',
    description: 'Black and white, monospaced, nothing extra.',
    handwritten: false,
    preset: {
      template: 'minimal',
      receiptTemplate: 'minimal',
      accent: '#111111',
      ink: '#111111',
      paper: '#ffffff',
      shade: '#f5f5f5',
      headingFont: 'IBM Plex Mono',
      bodyFont: 'IBM Plex Mono',
      inkFont: 'IBM Plex Mono',
      fontScale: 'md',
      rowsPerPage: 15,
    },
  },
};

export const DEFAULT_STYLE: DocumentStyle = TEMPLATES['classic-ink'].preset;

export interface ReceiptTemplateInfo {
  id: ReceiptTemplateId;
  name: string;
  description: string;
  /** colours and fonts come from this invoice template's preset (or the business's own, if it uses that template) */
  base: TemplateId;
}

export const RECEIPT_TEMPLATES: Record<ReceiptTemplateId, ReceiptTemplateInfo> = {
  'receipt-book': {
    id: 'receipt-book',
    name: 'Receipt Book',
    description: 'Received from… the sum of… — the carbon-copy book, in ink.',
    base: 'classic-ink',
  },
  modern: {
    id: 'modern',
    name: 'Clean Modern',
    description: 'White page with your accent colour and a bold amount box.',
    base: 'modern',
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal Mono',
    description: 'Plain black and white, monospaced.',
    base: 'minimal',
  },
  till: {
    id: 'till',
    name: 'Till Slip',
    description: 'A narrow shop receipt, like a POS printer — great for walk-in sales.',
    base: 'minimal',
  },
};

const RECEIPT_IDS = Object.keys(RECEIPT_TEMPLATES) as ReceiptTemplateId[];

/**
 * The style a receipt is drawn with. When the receipt template belongs to the
 * same family as the invoice template, the business's own colours and fonts are
 * kept; otherwise the receipt template's preset is used (text size carries over).
 */
export function receiptStyle(style: DocumentStyle): DocumentStyle {
  const receiptTemplate = RECEIPT_IDS.includes(style.receiptTemplate) ? style.receiptTemplate : 'receipt-book';
  const base = RECEIPT_TEMPLATES[receiptTemplate].base;
  if (base === style.template) return { ...style, receiptTemplate };
  return { ...TEMPLATES[base].preset, fontScale: style.fontScale, receiptTemplate };
}

export const MIN_ROWS = 8;
export const MAX_ROWS = 25;

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Coerce untrusted input into a valid style, falling back field by field. */
export function sanitizeStyle(input: unknown, fallback: DocumentStyle = DEFAULT_STYLE): DocumentStyle {
  const raw = (input && typeof input === 'object' ? input : {}) as Partial<Record<keyof DocumentStyle, unknown>>;
  const template = (Object.keys(TEMPLATES) as TemplateId[]).includes(raw.template as TemplateId)
    ? (raw.template as TemplateId)
    : fallback.template;
  const color = (v: unknown, fb: string) => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : fb);
  const font = (v: unknown, fb: string) =>
    typeof v === 'string' && FONT_OPTIONS.some((f) => f.family === v) ? v : fb;
  const rows = Number(raw.rowsPerPage);
  const receiptTemplate = RECEIPT_IDS.includes(raw.receiptTemplate as ReceiptTemplateId)
    ? (raw.receiptTemplate as ReceiptTemplateId)
    : RECEIPT_IDS.includes(fallback.receiptTemplate)
      ? fallback.receiptTemplate
      : 'receipt-book';
  return {
    template,
    receiptTemplate,
    accent: color(raw.accent, fallback.accent),
    ink: color(raw.ink, fallback.ink),
    paper: color(raw.paper, fallback.paper),
    shade: color(raw.shade, fallback.shade),
    headingFont: font(raw.headingFont, fallback.headingFont),
    bodyFont: font(raw.bodyFont, fallback.bodyFont),
    inkFont: font(raw.inkFont, fallback.inkFont),
    fontScale: (['sm', 'md', 'lg'] as const).includes(raw.fontScale as FontScale)
      ? (raw.fontScale as FontScale)
      : fallback.fontScale,
    rowsPerPage: Number.isInteger(rows)
      ? Math.min(MAX_ROWS, Math.max(MIN_ROWS, rows))
      : fallback.rowsPerPage,
  };
}

/** Free plan: Classic Ink invoices and Receipt Book receipts (colours, fonts and rows can still be tweaked). */
export function effectiveStyle(style: DocumentStyle, templatesAllowed: boolean): DocumentStyle {
  if (templatesAllowed) return style;
  const base = style.template === 'classic-ink' ? style : TEMPLATES['classic-ink'].preset;
  return { ...base, receiptTemplate: 'receipt-book' };
}

/** Does this style use anything that needs Pro? */
export function usesProTemplates(style: DocumentStyle): boolean {
  return style.template !== 'classic-ink' || style.receiptTemplate !== 'receipt-book';
}
