import {
  formatCedi,
  formatDisplayDate,
  formatRate,
  splitAmount,
  type AppliedTax,
  type Discount,
  type DocumentSnapshot,
  type LineItem,
} from '@olloo/shared';
import { CompanyHeader, FieldLine, Sheet, SignatureRow } from './Sheet';
import { isHandwritten } from './snapshot';
import { useDocumentFonts } from './fonts';

export interface ItemsDocumentProps {
  kind: 'invoice' | 'receipt';
  snapshot: DocumentSnapshot;
  number: string;
  customerName: string;
  customerAddress: string;
  customerPhone?: string;
  lpoNo?: string;
  date: string;
  dueDate?: string | null;
  items: LineItem[];
  subtotal: number;
  discount: Discount;
  discountAmount: number;
  taxes: AppliedTax[];
  total: number;
  notes?: string;
  /** itemized receipt: "Paid by Mobile Money · Ref 123" */
  paymentLine?: string;
  isVoid?: boolean;
  /** the oval "GH₵ total" ink stamp on Classic Ink invoices */
  showTotalStamp?: boolean;
}

function hasAmount(amount: number | null | undefined): amount is number {
  return typeof amount === 'number' && Number.isFinite(amount) && amount !== 0;
}

/** Split line items into pages of rowsPerPage. */
function chunkItems(items: LineItem[], size: number): LineItem[][] {
  if (items.length === 0) return [[]];
  const pages: LineItem[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}

/** Lines between sub-total and TOTAL; empty when there's no discount or tax (keeps the plain look). */
function breakdown(props: ItemsDocumentProps): Array<[string, number]> {
  const lines: Array<[string, number]> = [];
  if (props.discountAmount > 0) {
    const label = props.discount.type === 'percent' ? `Discount (${formatRate(props.discount.value)})` : 'Discount';
    lines.push([label, -props.discountAmount]);
  }
  for (const t of props.taxes) lines.push([`${t.name} (${formatRate(t.rateBps)})`, t.amount]);
  return lines.length ? [['Sub-total', props.subtotal], ...lines] : [];
}

export function ItemsDocument(props: ItemsDocumentProps) {
  const { style } = props.snapshot;
  useDocumentFonts(style);
  const filled = props.items.filter((i) => i.description.trim() || i.amount);
  const pages = chunkItems(filled, style.rowsPerPage);

  return (
    <div className="doc-document mx-auto flex w-full max-w-180 flex-col gap-6">
      {pages.map((pageItems, index) => {
        const isLast = index === pages.length - 1;
        const pageProps = {
          ...props,
          pageItems,
          isLast,
          pageLabel: pages.length > 1 ? `Page ${index + 1} of ${pages.length}` : undefined,
        };
        return (
          <Sheet key={index} style={style} watermark={props.snapshot.watermark && isLast} isVoid={props.isVoid}>
            {isHandwritten(style) ? <LedgerPage {...pageProps} /> : <CleanPage {...pageProps} />}
          </Sheet>
        );
      })}
    </div>
  );
}

interface PageProps extends ItemsDocumentProps {
  pageItems: LineItem[];
  isLast: boolean;
  pageLabel?: string;
}

const title = (kind: 'invoice' | 'receipt') => (kind === 'invoice' ? 'INVOICE' : 'RECEIPT');

/* ---------- Classic Ink: the paper ledger ---------- */

function LedgerPage(p: PageProps) {
  const { company, style } = p.snapshot;
  const rows: Array<LineItem | null> = [...p.pageItems];
  while (rows.length < style.rowsPerPage) rows.push(null);
  const total = splitAmount(p.total);
  const lines = breakdown(p);

  return (
    <>
      <CompanyHeader company={company} style={style} />

      <div className="relative mt-3">
        <h2 className="doc-heading text-center text-[1.5em] font-bold tracking-[0.2em] underline sm:text-[1.875em]">{title(p.kind)}</h2>
        <div className="mt-1 flex items-baseline justify-center gap-1 text-[0.875em] sm:absolute sm:right-0 sm:bottom-0 sm:mt-0">
          <span>№</span>
          <span className="doc-ink doc-rule min-w-22 border-b border-dotted px-1 text-[1.15em]">{p.number || '_______'}</span>
        </div>
      </div>

      {p.pageLabel && <p className="mt-1 text-center text-[0.65em] text-black/60">{p.pageLabel}</p>}

      <div className="mt-4 space-y-2">
        <FieldLine label="Customer's Name" value={p.customerName} handwritten />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <FieldLine label="Address" value={p.customerAddress} handwritten />
          <div className="flex min-w-36 items-end gap-2">
            <span className="shrink-0 text-[0.875em]">Date</span>
            <span className="doc-ink doc-rule flex-1 border-b border-dotted px-1 text-[1.875em] leading-[1.2]">
              {p.date ? formatDisplayDate(p.date) : ' '}
            </span>
          </div>
        </div>
        {p.kind === 'invoice' ? (
          <FieldLine label="L.P.O. No." value={p.lpoNo} handwritten />
        ) : (
          p.paymentLine && <FieldLine label="Paid by" value={p.paymentLine} handwritten />
        )}
      </div>

      <div className="relative mt-4 overflow-x-auto">
        <table className="doc-rule w-full min-w-140 border-collapse border">
          <thead className="text-[0.875em]">
            <tr className="doc-rule border-b">
              <th className="doc-rule w-14 border-r px-1 py-1.5 text-center font-semibold">Qty.</th>
              <th className="doc-rule border-r px-2 py-1.5 text-left font-semibold">Description of Goods</th>
              <th className="doc-rule w-24 border-r px-1 py-1.5 text-center font-semibold">Unit Price</th>
              <th className="w-36 px-0 py-1.5 text-center font-semibold" colSpan={2}>
                Amount ₵
              </th>
            </tr>
            <tr className="doc-rule doc-shade border-b">
              <th className="doc-rule border-r" />
              <th className="doc-rule border-r" />
              <th className="doc-rule border-r" />
              <th className="doc-rule w-24 border-r border-double py-0.5 text-[0.75em] font-normal text-black/60">₵</th>
              <th className="w-12 py-0.5 text-[0.75em] font-normal text-black/60">Gp</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item, i) => {
              const parts = item && hasAmount(item.amount) ? splitAmount(item.amount) : null;
              return (
                <tr key={i} className="doc-rule border-b border-dotted text-[1.875em] leading-[1.2]">
                  <td className="doc-ink doc-rule h-7 border-r px-1 text-center">{item?.qty || ''}</td>
                  <td className="doc-ink doc-rule border-r px-2">{item?.description || ''}</td>
                  <td className="doc-ink doc-rule border-r px-1 text-right">
                    {item?.unitPrice != null && item.unitPrice > 0 ? formatCedi(item.unitPrice) : ''}
                  </td>
                  <td className="doc-ink doc-rule doc-shade border-r border-double px-1 text-right">{parts?.whole ?? ''}</td>
                  <td className="doc-ink doc-shade px-1 text-center">{parts?.cents ?? ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {p.isLast && p.showTotalStamp && hasAmount(p.total) && (
          <div className="pointer-events-none absolute top-4/5 left-2/3 z-10 -translate-x-1/2 -translate-y-1/2 rotate-[-18deg]" aria-hidden>
            <div className="doc-ink doc-ink-border rounded-[50%] border-[3px] px-5 py-6 text-[1.25em] font-semibold opacity-80">
              GH₵ {formatCedi(p.total)}
            </div>
          </div>
        )}
        {p.isLast && p.kind === 'receipt' && (
          <div className="pointer-events-none absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rotate-[-14deg]" aria-hidden>
            <div className="doc-ink doc-ink-border rounded-lg border-4 px-6 py-1 font-sans text-[2.4em] font-black tracking-[0.3em] opacity-60">
              PAID
            </div>
          </div>
        )}
      </div>

      {p.isLast ? (
        <>
          {lines.length > 0 && (
            <div className="mt-2 ml-auto w-full max-w-80 space-y-0.5">
              {lines.map(([label, amount]) => (
                <div key={label} className="flex items-end justify-between gap-3">
                  <span className="text-[0.8em]">{label}</span>
                  <span className="doc-ink doc-rule min-w-32 border-b border-dotted px-1 text-right text-[1.5em] leading-[1.2]">
                    {formatCedi(amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex items-end justify-between gap-4">
            <p className="text-[0.75em] italic sm:text-[0.875em]">{p.snapshot.company.footerText}</p>
            <div className="doc-rule flex items-stretch border-2">
              <div className="doc-rule doc-shade flex items-center border-r-2 px-3 text-[0.875em] font-bold">TOTAL ₵</div>
              <div className="flex min-w-36">
                <span className="doc-ink doc-rule doc-shade flex-1 border-r border-double px-2 py-1.5 text-right text-[1.875em] leading-[1.2]">
                  {total.whole}
                </span>
                <span className="doc-ink doc-shade w-10 px-1 py-1.5 text-center text-[1.875em] leading-[1.2]">{total.cents}</span>
              </div>
            </div>
          </div>
          {p.notes && <p className="mt-3 text-[0.8em] whitespace-pre-line">{p.notes}</p>}
          <SignatureRow
            signatureUrl={company.signatureUrl}
            labels={p.kind === 'invoice' ? ["Customer's Signature", "Manager's Signature"] : [null, 'Received by']}
            handwritten
          />
        </>
      ) : (
        <Pto />
      )}
    </>
  );
}

/* ---------- Clean Modern / Minimal Mono ---------- */

function CleanPage(p: PageProps) {
  const { company, style } = p.snapshot;
  const filledHeader = style.template === 'modern';
  const lines = breakdown(p);

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <CompanyHeader company={company} style={style} />
        <div className="shrink-0 sm:text-right">
          <h2 className="doc-heading doc-accent-text text-[1.9em] leading-none font-bold tracking-[0.12em]">{title(p.kind)}</h2>
          <p className="mt-2 text-[0.85em]">
            <span className="text-black/55">No. </span>
            <span className="doc-ink font-semibold">{p.number || '—'}</span>
          </p>
          <p className="text-[0.85em]">
            <span className="text-black/55">Date </span>
            <span className="doc-ink">{formatDisplayDate(p.date)}</span>
          </p>
          {p.dueDate && (
            <p className="text-[0.85em]">
              <span className="text-black/55">Due </span>
              <span className="doc-ink">{formatDisplayDate(p.dueDate)}</span>
            </p>
          )}
          {p.pageLabel && <p className="mt-1 text-[0.7em] text-black/55">{p.pageLabel}</p>}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-[0.7em] font-semibold tracking-wide text-black/55 uppercase">{p.kind === 'invoice' ? 'Bill to' : 'Received from'}</p>
          <p className="doc-ink mt-1 text-[1.05em] font-semibold">{p.customerName || ' '}</p>
          {p.customerAddress && <p className="doc-ink text-[0.85em]">{p.customerAddress}</p>}
          {p.customerPhone && <p className="doc-ink text-[0.85em]">{p.customerPhone}</p>}
        </div>
        <div className="sm:text-right">
          {p.kind === 'invoice' && p.lpoNo && (
            <p className="text-[0.85em]">
              <span className="text-black/55">L.P.O. No. </span>
              <span className="doc-ink">{p.lpoNo}</span>
            </p>
          )}
          {p.paymentLine && (
            <p className="text-[0.85em]">
              <span className="text-black/55">Paid by </span>
              <span className="doc-ink">{p.paymentLine}</span>
            </p>
          )}
        </div>
      </div>

      <div className="relative mt-5 overflow-x-auto">
        <table className="w-full min-w-120 border-collapse text-[0.875em]">
          <thead>
            <tr className={filledHeader ? 'doc-accent-bg' : 'doc-rule border-y-2'}>
              <th className="px-2 py-2 text-left font-semibold">Description</th>
              <th className="w-16 px-2 py-2 text-center font-semibold">Qty</th>
              <th className="w-28 px-2 py-2 text-right font-semibold">Unit price</th>
              <th className="w-32 px-2 py-2 text-right font-semibold">Amount (GH₵)</th>
            </tr>
          </thead>
          <tbody>
            {p.pageItems.map((item, i) => (
              <tr key={i} className={`border-b border-black/10 ${filledHeader && i % 2 === 1 ? 'doc-shade' : ''}`}>
                <td className="doc-ink px-2 py-2">{item.description}</td>
                <td className="doc-ink px-2 py-2 text-center">{item.qty}</td>
                <td className="doc-ink px-2 py-2 text-right tabular-nums">
                  {item.unitPrice != null && item.unitPrice > 0 ? formatCedi(item.unitPrice) : ''}
                </td>
                <td className="doc-ink px-2 py-2 text-right tabular-nums">{hasAmount(item.amount) ? formatCedi(item.amount) : ''}</td>
              </tr>
            ))}
            {p.pageItems.length === 0 && (
              <tr className="border-b border-black/10">
                <td className="px-2 py-6 text-center text-black/40" colSpan={4}>
                  No items yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {p.isLast && p.kind === 'receipt' && (
          <div className="pointer-events-none absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rotate-[-14deg]" aria-hidden>
            <div className="doc-accent-text rounded-lg border-4 border-current px-6 py-1 font-sans text-[2.2em] font-black tracking-[0.3em] opacity-40">
              PAID
            </div>
          </div>
        )}
      </div>

      {p.isLast ? (
        <>
          <div className="mt-4 ml-auto w-full max-w-72 text-[0.9em]">
            {lines.map(([label, amount]) => (
              <div key={label} className="flex justify-between gap-3 py-0.5">
                <span className="text-black/65">{label}</span>
                <span className="doc-ink tabular-nums">{formatCedi(amount)}</span>
              </div>
            ))}
            <div className={`mt-1 flex justify-between gap-3 px-2 py-2 font-bold ${filledHeader ? 'doc-accent-bg rounded' : 'doc-rule border-y-2'}`}>
              <span>{p.kind === 'invoice' ? 'Total due' : 'Total paid'}</span>
              <span className="tabular-nums">GH₵ {formatCedi(p.total)}</span>
            </div>
          </div>
          {p.notes && <p className="mt-4 text-[0.8em] whitespace-pre-line text-black/75">{p.notes}</p>}
          {company.footerText && <p className="mt-4 text-[0.75em] text-black/60 italic">{company.footerText}</p>}
          <SignatureRow
            signatureUrl={company.signatureUrl}
            labels={p.kind === 'invoice' ? ["Customer's signature", 'Authorised signature'] : [null, 'Received by']}
            handwritten={false}
          />
        </>
      ) : (
        <Pto />
      )}
    </>
  );
}

function Pto() {
  return (
    <div className="mt-6 flex flex-col items-end gap-1">
      <p className="text-[1.05em] font-bold tracking-[0.25em]">P.T.O.</p>
      <p className="text-[0.65em] text-black/60 italic">Please turn over</p>
    </div>
  );
}
