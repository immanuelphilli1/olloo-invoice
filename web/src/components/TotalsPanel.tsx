import { formatGhs, formatRate, type Totals } from '@olloo/shared';
import { Link } from 'react-router-dom';
import type { DraftDiscount } from '../lib/draft';
import { inputClass } from './ui';

/** Discount controls + the running totals under the line items. */
export function TotalsPanel({
  discount,
  onDiscountChange,
  totals,
  taxesConfigured,
}: {
  discount: DraftDiscount;
  onDiscountChange: (d: DraftDiscount) => void;
  totals: Totals;
  /** no enabled taxes → hint where to switch them on */
  taxesConfigured: boolean;
}) {
  return (
    <div className="mt-5 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
      <div className="space-y-2 text-sm">
        <span className="font-medium text-slate-700">Discount</span>
        <div className="flex gap-2">
          <select
            value={discount.type}
            onChange={(e) => onDiscountChange({ type: e.target.value as DraftDiscount['type'], value: discount.value })}
            className={`${inputClass} w-36`}
          >
            <option value="none">None</option>
            <option value="percent">Percent %</option>
            <option value="fixed">Amount GH₵</option>
          </select>
          {discount.type !== 'none' && (
            <input
              value={discount.value}
              onChange={(e) => onDiscountChange({ ...discount, value: e.target.value })}
              inputMode="decimal"
              placeholder={discount.type === 'percent' ? '10' : '50.00'}
              className={`${inputClass} w-28`}
            />
          )}
        </div>
        {!taxesConfigured && (
          <p className="text-xs text-slate-500">
            Need VAT, NHIL or GETFund lines?{' '}
            <Link to="/settings?tab=taxes" className="text-teal-700 hover:underline">
              Turn on taxes
            </Link>
          </p>
        )}
      </div>
      <dl className="space-y-1 text-sm sm:text-right">
        {(totals.discountAmount > 0 || totals.taxes.length > 0) && (
          <div className="flex justify-between gap-4 sm:justify-end">
            <dt className="text-slate-500">Sub-total</dt>
            <dd className="tabular-nums">{formatGhs(totals.subtotal)}</dd>
          </div>
        )}
        {totals.discountAmount > 0 && (
          <div className="flex justify-between gap-4 sm:justify-end">
            <dt className="text-slate-500">Discount</dt>
            <dd className="tabular-nums">−{formatGhs(totals.discountAmount)}</dd>
          </div>
        )}
        {totals.taxes.map((t) => (
          <div key={t.name} className="flex justify-between gap-4 sm:justify-end">
            <dt className="text-slate-500">
              {t.name} ({formatRate(t.rateBps)})
            </dt>
            <dd className="tabular-nums">{formatGhs(t.amount)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 pt-1 text-base font-semibold text-slate-900 sm:justify-end">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatGhs(totals.total)}</dd>
        </div>
      </dl>
    </div>
  );
}
