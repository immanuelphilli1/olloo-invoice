import {
  amountInWords,
  formatCedi,
  formatDisplayDate,
  PAYMENT_METHODS,
  splitAmount,
  type DocumentSnapshot,
  type PaymentMethod,
} from '@olloo/shared';
import { CompanyHeader, FieldLine, Sheet, SignatureRow } from './Sheet';
import { isHandwritten } from './snapshot';
import { useDocumentFonts } from './fonts';

export interface ReceiptClassicProps {
  snapshot: DocumentSnapshot;
  number: string;
  date: string;
  customerName: string;
  amount: number;
  paymentFor: string;
  method: PaymentMethod;
  reference: string;
  /** invoice balance after this payment; null for standalone receipts */
  balanceAfter: number | null;
  isVoid?: boolean;
}

/** The receipt-book layout: Received from … the sum of … being payment for … */
export function ReceiptClassic(p: ReceiptClassicProps) {
  const { company, style } = p.snapshot;
  useDocumentFonts(style);
  const handwritten = isHandwritten(style);
  const amount = splitAmount(p.amount);
  const words = p.amount > 0 ? `${amountInWords(p.amount)} only` : '';

  return (
    <div className="doc-document mx-auto flex w-full max-w-180 flex-col gap-6">
      <Sheet style={style} watermark={p.snapshot.watermark} isVoid={p.isVoid}>
        <CompanyHeader company={company} style={style} />

        <div className="relative mt-4 flex flex-col items-center gap-1 sm:flex-row sm:justify-between">
          <h2
            className={`doc-heading text-[1.35em] font-bold sm:text-[1.6em] ${
              handwritten ? 'tracking-[0.15em] underline' : 'doc-accent-text tracking-[0.1em]'
            }`}
          >
            OFFICIAL RECEIPT
          </h2>
          <div className="flex items-baseline gap-1 text-[0.875em]">
            <span>№</span>
            <span className={`doc-ink min-w-22 px-1 text-[1.15em] ${handwritten ? 'doc-rule border-b border-dotted' : 'font-semibold'}`}>
              {p.number || '_______'}
            </span>
          </div>
        </div>

        <div className="mt-2 flex justify-end">
          <div className="w-full max-w-56">
            <FieldLine label="Date" value={formatDisplayDate(p.date)} handwritten={handwritten} />
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <FieldLine label="Received from" value={p.customerName} handwritten={handwritten} />
          <FieldLine label="the sum of" value={words} handwritten={handwritten} />
          <FieldLine label="being payment for" value={p.paymentFor} handwritten={handwritten} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.85em]">
          {PAYMENT_METHODS.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1.5">
              <span
                className={`doc-rule inline-flex h-4 w-4 items-center justify-center border text-[0.9em] leading-none ${
                  m.id === p.method ? 'doc-ink font-bold' : ''
                }`}
                aria-hidden
              >
                {m.id === p.method ? '✓' : ''}
              </span>
              {m.label}
            </span>
          ))}
          {p.reference && (
            <span className="inline-flex items-baseline gap-1">
              Ref: <span className={`doc-ink font-semibold ${handwritten ? "text-[1.35em]" : ""}`}>{p.reference}</span>
            </span>
          )}
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-[auto_1fr] sm:items-end">
          <div>
            {handwritten ? (
              <div className="doc-rule flex items-stretch border-2">
                <div className="doc-rule doc-shade flex items-center border-r-2 px-3 text-[0.875em] font-bold">GH₵</div>
                <div className="flex min-w-40">
                  <span className="doc-ink doc-rule doc-shade flex-1 border-r border-double px-2 py-1.5 text-right text-[1.875em] leading-[1.2]">
                    {amount.whole}
                  </span>
                  <span className="doc-ink doc-shade w-10 px-1 py-1.5 text-center text-[1.875em] leading-[1.2]">{amount.cents}</span>
                </div>
              </div>
            ) : (
              <div className="doc-accent-bg rounded px-4 py-2 text-[1.3em] font-bold tabular-nums">GH₵ {formatCedi(p.amount)}</div>
            )}
            {p.balanceAfter != null && (
              <p className="mt-2 text-[0.85em]">
                Balance outstanding: <span className={`doc-ink font-semibold ${handwritten ? "text-[1.5em]" : ""}`}>GH₵ {formatCedi(p.balanceAfter)}</span>
              </p>
            )}
          </div>
          {company.footerText && <p className="text-[0.75em] italic sm:text-right">{company.footerText}</p>}
        </div>

        <SignatureRow signatureUrl={company.signatureUrl} labels={[null, 'Received by']} handwritten={handwritten} />
      </Sheet>
    </div>
  );
}
