import { amountInWords, formatCedi, formatDisplayDate, formatRate, type Receipt } from '@olloo/shared';
import { useDocumentFonts } from './fonts';
import { Sheet } from './Sheet';
import { paymentLine } from './snapshot';

/** Width the slip is designed (and captured for WhatsApp) at — roughly an 80 mm till roll. */
export const TILL_WIDTH = 340;

function Rule() {
  return <div className="my-2.5 border-t border-dashed border-black/40" aria-hidden />;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? 'text-[1.25em] font-bold' : ''}`}>
      <span className="shrink-0 whitespace-nowrap">{label}</span>
      <span className="text-right tabular-nums">{value}</span>
    </div>
  );
}

const ZIGZAG = 'conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) 50% / 10px 100%';

/** Torn-paper edge: a row of paper-coloured teeth (flip for the top edge). */
function TornEdge({ flip }: { flip?: boolean }) {
  return (
    <div
      aria-hidden
      className="h-[5px] w-full"
      style={{
        background: 'var(--slip-paper)',
        mask: ZIGZAG,
        WebkitMask: ZIGZAG,
        transform: flip ? 'rotate(180deg)' : undefined,
      }}
    />
  );
}

/** Narrow POS-style receipt, for both money-received and itemized receipts. */
export function TillReceipt({ receipt }: { receipt: Receipt }) {
  const { company, style, watermark } = receipt.snapshot;
  useDocumentFonts(style);
  const itemized = receipt.layout === 'itemized';
  const hasBreakdown = receipt.discountAmount > 0 || receipt.taxes.length > 0;

  return (
    <div
      className="doc-document mx-auto w-full drop-shadow-[0_6px_14px_rgba(0,0,0,0.14)]"
      style={{ maxWidth: TILL_WIDTH, ['--slip-paper' as string]: style.paper }}
      data-doc-width={TILL_WIDTH}
    >
      <TornEdge flip />
      <Sheet style={style} watermark={watermark} isVoid={receipt.status === 'void'} variant="slip">
        <div className="text-center text-[0.8em] leading-snug">
          {company.logoUrl && <img src={company.logoUrl} alt="" className="mx-auto mb-2 h-12 w-auto max-w-[70%] object-contain grayscale" />}
          <p className="doc-heading text-[1.15em] font-bold tracking-wide uppercase">{company.name}</p>
          {company.location && <p>{company.location}</p>}
          {company.poBox && <p>{company.poBox}</p>}
          {company.phone && <p>Tel: {company.phone}</p>}
          {company.tin && <p>TIN: {company.tin}</p>}
        </div>

        <Rule />
        <div className="text-[0.8em]">
          <p className="text-center text-[1.1em] font-bold tracking-[0.25em]">RECEIPT</p>
          <Row label="No." value={receipt.number} />
          <Row label="Date" value={formatDisplayDate(receipt.date)} />
          {receipt.customerName && <Row label="Customer" value={receipt.customerName} />}
          {receipt.invoiceNumber && <Row label="Invoice" value={receipt.invoiceNumber} />}
        </div>
        <Rule />

        <div className="space-y-1.5 text-[0.8em]">
          {itemized ? (
            receipt.items.map((item, i) => (
              <div key={i}>
                <p className="doc-ink">{item.description}</p>
                <div className="flex justify-between gap-3 text-black/70">
                  <span>
                    {item.qty || '1'}
                    {item.unitPrice != null && item.unitPrice > 0 ? ` × ${formatCedi(item.unitPrice)}` : ''}
                  </span>
                  <span className="doc-ink tabular-nums">{formatCedi(item.amount)}</span>
                </div>
              </div>
            ))
          ) : (
            <>
              {receipt.paymentFor && <p className="doc-ink">{receipt.paymentFor}</p>}
              <p className="text-black/70 italic">{amountInWords(receipt.amount)} only</p>
            </>
          )}
          {itemized && receipt.items.length === 0 && <p className="text-center text-black/40">No items yet</p>}
        </div>

        <Rule />
        <div className="space-y-0.5 text-[0.8em]">
          {itemized && hasBreakdown && (
            <>
              <Row label="Sub-total" value={formatCedi(receipt.subtotal)} />
              {receipt.discountAmount > 0 && <Row label="Discount" value={`-${formatCedi(receipt.discountAmount)}`} />}
              {receipt.taxes.map((t) => (
                <Row key={t.name} label={`${t.name} ${formatRate(t.rateBps)}`} value={formatCedi(t.amount)} />
              ))}
            </>
          )}
          <Row label="TOTAL GH₵" value={formatCedi(receipt.amount)} strong />
          <Row label="Paid by" value={paymentLine(receipt.method, receipt.reference)} />
          {receipt.balanceAfter != null && <Row label="Balance due" value={`GH₵ ${formatCedi(receipt.balanceAfter)}`} />}
        </div>

        <Rule />
        <div className="text-center text-[0.75em] leading-snug">
          {itemized && receipt.paymentFor && <p className="mb-1">{receipt.paymentFor}</p>}
          {company.footerText && <p className="italic">{company.footerText}</p>}
          <p className="mt-1 font-bold tracking-wide">THANK YOU!</p>
        </div>
      </Sheet>
      <TornEdge />
    </div>
  );
}
