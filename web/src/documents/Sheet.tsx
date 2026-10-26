import { fontCss, type CompanyInfo, type DocumentStyle } from '@olloo/shared';
import type { CSSProperties, ReactNode } from 'react';
import { isHandwritten } from './snapshot';

const FONT_SIZE = { sm: '14px', md: '16px', lg: '18px' } as const;

function sheetVars(style: DocumentStyle): CSSProperties {
  return {
    '--doc-paper': style.paper,
    '--doc-ink': style.ink,
    '--doc-accent': style.accent,
    '--doc-shade': style.shade,
    '--doc-heading-font': fontCss(style.headingFont),
    '--doc-body-font': fontCss(style.bodyFont),
    '--doc-ink-font': fontCss(style.inkFont),
    '--doc-size': FONT_SIZE[style.fontScale],
  } as CSSProperties;
}

/** One printed page: paper colour, fonts, watermark and VOID stamp. */
export function Sheet({
  style,
  watermark,
  isVoid,
  variant = 'page',
  children,
}: {
  style: DocumentStyle;
  watermark: boolean;
  isVoid?: boolean;
  /** 'slip' = narrow till receipt: tighter padding, no page shadow (its torn edges carry one) */
  variant?: 'page' | 'slip';
  children: ReactNode;
}) {
  return (
    <article
      className={`doc-sheet relative w-full overflow-hidden ${
        variant === 'slip' ? 'px-5 py-5' : 'px-4 py-5 shadow-[0_8px_30px_rgba(0,0,0,0.12)] sm:px-8 sm:py-6'
      }`}
      style={sheetVars(style)}
    >
      {children}
      {watermark && <Watermark />}
      {isVoid && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center" aria-hidden>
          <span className="rotate-[-18deg] rounded-xl border-[6px] border-red-600/70 px-8 py-2 font-sans text-[4.5em] font-black tracking-[0.2em] text-red-600/70">
            VOID
          </span>
        </div>
      )}
    </article>
  );
}

function Watermark() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-around overflow-hidden" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="rotate-[-24deg] font-sans text-[2.6em] font-bold whitespace-nowrap text-black/[0.06]">
            Made with olloo
          </span>
        ))}
      </div>
      <p className="relative z-10 mt-4 text-center font-sans text-[0.65em] text-black/45">
        Made with olloo invoice · olloo.app
      </p>
    </>
  );
}

/** Logo + business name and contact lines. Centered on Classic Ink, left-aligned otherwise. */
export function CompanyHeader({ company, style }: { company: CompanyInfo; style: DocumentStyle }) {
  const lines = [
    company.location,
    company.poBox,
    [company.phone && `Tel: ${company.phone}`, company.email].filter(Boolean).join(' · '),
    company.tin && `TIN: ${company.tin}`,
  ].filter(Boolean);

  if (isHandwritten(style)) {
    return (
      <header className="doc-heading pb-2 text-center">
        {company.logoUrl && <img src={company.logoUrl} alt="" className="mx-auto mb-2 h-14 w-auto max-w-[60%] object-contain" />}
        <h1 className="text-[1.55em] font-bold tracking-wide sm:text-[1.85em]">{company.name}</h1>
        {lines.map((line, i) => (
          <p key={i} className={`text-[0.7em] leading-snug sm:text-[0.75em] ${i === 0 ? 'mt-1' : ''}`}>
            {line}
          </p>
        ))}
      </header>
    );
  }

  return (
    <header className="flex items-start gap-4">
      {company.logoUrl && <img src={company.logoUrl} alt="" className="h-16 w-auto max-w-[30%] object-contain" />}
      <div className="min-w-0">
        <h1 className="doc-heading doc-accent-text text-[1.4em] font-bold leading-tight sm:text-[1.6em]">{company.name}</h1>
        {lines.map((line, i) => (
          <p key={i} className="text-[0.75em] leading-snug text-black/70">
            {line}
          </p>
        ))}
      </div>
    </header>
  );
}

/** "Customer's Name ........ value" on ruled paper, or a plain label/value pair. */
export function FieldLine({
  label,
  value,
  handwritten,
  className = '',
}: {
  label: string;
  value: ReactNode;
  handwritten: boolean;
  className?: string;
}) {
  if (handwritten) {
    return (
      <div className={`flex items-end gap-2 ${className}`}>
        <span className="shrink-0 text-[0.875em]">{label}</span>
        <span className="doc-ink doc-rule min-h-5 flex-1 border-b border-dotted px-1 text-[1.875em] leading-[1.2]">
          {value || ' '}
        </span>
      </div>
    );
  }
  return (
    <div className={`flex items-baseline gap-2 ${className}`}>
      <span className="shrink-0 text-[0.75em] font-semibold uppercase tracking-wide text-black/55">{label}</span>
      <span className="doc-ink doc-ink-border min-h-5 flex-1 border-b px-1 text-[0.95em]">{value || ' '}</span>
    </div>
  );
}

export function SignatureRow({
  signatureUrl,
  labels,
  handwritten,
}: {
  signatureUrl: string | null;
  /** [left, right]; the business signature goes on the right */
  labels: [string | null, string];
  handwritten: boolean;
}) {
  const line = handwritten ? 'doc-rule border-b border-dotted' : 'border-b border-black/40';
  return (
    <div className="mt-2 grid grid-cols-2 gap-6 text-[0.75em] sm:gap-8 md:mt-8">
      <div className="flex flex-col">
        {labels[0] && (
          <>
            <div className="flex h-14 items-end sm:h-16">
              <div className={`w-full ${line}`} />
            </div>
            <p className="mt-1 text-center">{labels[0]}</p>
          </>
        )}
      </div>
      <div className="flex flex-col">
        <div className="relative flex h-14 items-end sm:h-16">
          {signatureUrl && (
            <img
              src={signatureUrl}
              alt="Signature"
              className="pointer-events-none absolute bottom-0.5 left-1/2 h-12 w-auto max-w-full -translate-x-1/2 object-contain object-bottom sm:h-14"
            />
          )}
          <div className={`w-full ${line}`} />
        </div>
        <p className="mt-1 text-center">{labels[1]}</p>
      </div>
    </div>
  );
}
