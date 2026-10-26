import {
  RECEIPT_TEMPLATES,
  receiptStyle,
  TEMPLATES,
  type DocumentSnapshot,
  type ReceiptTemplateId,
  type TemplateId,
} from '@olloo/shared';
import type { ReactNode } from 'react';
import { ReceiptDocument } from '../documents';
import { ItemsDocument } from '../documents/ItemsDocument';
import { sampleInvoiceProps, sampleReceipt } from '../documents/sample';
import { TILL_WIDTH } from '../documents/TillReceipt';
import { ProBadge } from './ui';

/** A live document laid out at full width (720px) and scaled down. */
export function Thumbnail({
  scale = 0.32,
  height = 1020,
  width = 720,
  children,
}: {
  scale?: number;
  height?: number;
  /** layout width before scaling: 720 for A4 documents, TILL_WIDTH for a till slip */
  width?: number;
  children: ReactNode;
}) {
  return (
    <div className="pointer-events-none relative mx-auto overflow-hidden rounded-md" style={{ height: height * scale, width: width * scale, maxWidth: '100%' }} aria-hidden>
      <div className="absolute top-0 left-0 origin-top-left" style={{ width, transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}

/** A live, scaled-down sample invoice. */
export function DocumentThumbnail({ snapshot, scale = 0.32 }: { snapshot: DocumentSnapshot; scale?: number }) {
  return (
    <Thumbnail scale={scale}>
      <ItemsDocument {...sampleInvoiceProps({ ...snapshot, watermark: false })} />
    </Thumbnail>
  );
}

function PickerCard({
  selected,
  locked,
  onClick,
  name,
  description,
  children,
}: {
  selected: boolean;
  locked: boolean;
  onClick: () => void;
  name: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={locked}
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-xl border-2 bg-white p-2 text-left transition ${
        selected ? 'border-teal-600 ring-2 ring-teal-600/20' : 'border-slate-200 hover:border-slate-300'
      } ${locked ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <div style={{ width: 720 * 0.3 }} className="mx-auto max-w-full">
        {children}
      </div>
      <div className="mt-2 flex items-center gap-2 px-1">
        <span className="font-semibold text-slate-900">{name}</span>
        {locked && <ProBadge />}
      </div>
      <p className="px-1 pb-1 text-xs text-slate-500">{description}</p>
    </button>
  );
}

export function TemplatePicker({
  value,
  onChange,
  baseSnapshot,
  templatesAllowed,
}: {
  value: TemplateId;
  onChange: (id: TemplateId) => void;
  /** company info + current colours; each card swaps in its template's preset */
  baseSnapshot: DocumentSnapshot;
  templatesAllowed: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {Object.values(TEMPLATES).map((t) => (
        <PickerCard
          key={t.id}
          selected={value === t.id}
          locked={!templatesAllowed && t.id !== 'classic-ink'}
          onClick={() => onChange(t.id)}
          name={t.name}
          description={t.description}
        >
          <DocumentThumbnail snapshot={{ ...baseSnapshot, style: t.preset }} scale={0.3} />
        </PickerCard>
      ))}
    </div>
  );
}

export function ReceiptTemplatePicker({
  value,
  onChange,
  baseSnapshot,
  templatesAllowed,
}: {
  value: ReceiptTemplateId;
  onChange: (id: ReceiptTemplateId) => void;
  /** company info + the business's current style (same-family receipt templates keep its colours) */
  baseSnapshot: DocumentSnapshot;
  templatesAllowed: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Object.values(RECEIPT_TEMPLATES).map((t) => {
        const style = { ...baseSnapshot.style, receiptTemplate: t.id };
        const sample = sampleReceipt({ ...baseSnapshot, style, watermark: false }, t.id === 'till' ? 'itemized' : 'classic');
        return (
          <PickerCard
            key={t.id}
            selected={value === t.id}
            locked={!templatesAllowed && t.id !== 'receipt-book'}
            onClick={() => onChange(t.id)}
            name={t.name}
            description={t.description}
          >
            <Thumbnail {...(receiptStyle(style).receiptTemplate === 'till' ? { scale: 0.5, width: TILL_WIDTH, height: 560 } : { scale: 0.24, height: 760 })}>
              <ReceiptDocument receipt={sample} />
            </Thumbnail>
          </PickerCard>
        );
      })}
    </div>
  );
}
