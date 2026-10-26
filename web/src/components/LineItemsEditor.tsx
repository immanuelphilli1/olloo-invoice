import { formatCedi, pesewasToInput, toPesewas } from '@olloo/shared';
import { useId } from 'react';
import { useProducts } from '../lib/catalog';
import { emptyItem, updateItem, type DraftItem } from '../lib/draft';

const cell = 'rounded-lg border border-slate-300 px-2 py-2 text-sm focus:border-teal-500 focus:outline-none';

/** Qty · description · unit · amount rows with reorder/remove — as on the original invoice page. */
export function LineItemsEditor({ items, onChange }: { items: DraftItem[]; onChange: (items: DraftItem[]) => void }) {
  const listId = useId();
  const { data: products = [] } = useProducts();

  const patch = (index: number, change: Partial<DraftItem>) => {
    onChange(items.map((item, i) => (i === index ? updateItem(item, change) : item)));
  };

  const setDescription = (index: number, description: string) => {
    // Picking a saved product fills in its price.
    const product = products.find((p) => p.name === description);
    const change: Partial<DraftItem> = { description };
    if (product?.unitPrice != null && !items[index]!.unitPrice) change.unitPrice = pesewasToInput(product.unitPrice);
    if (product && !items[index]!.qty) change.qty = '1';
    patch(index, change);
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row!);
    onChange(next);
  };

  const remove = (index: number) => {
    onChange(items.length <= 1 ? [emptyItem()] : items.filter((_, i) => i !== index));
  };

  return (
    <div>
      <datalist id={listId}>
        {products.map((p) => (
          <option key={p.id} value={p.name}>
            {p.unitPrice != null ? `GH₵ ${formatCedi(p.unitPrice)}` : ''}
          </option>
        ))}
      </datalist>
      <div className="mb-2 hidden grid-cols-[4rem_1fr_6.5rem_6.5rem_auto] gap-2 px-0.5 text-xs font-medium text-slate-500 sm:grid">
        <span>Qty</span>
        <span>Description</span>
        <span>Unit price</span>
        <span>Amount</span>
        <span className="w-24" />
      </div>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={index}
            className="rounded-lg border border-slate-100 bg-slate-50/80 p-2 sm:grid sm:grid-cols-[4rem_1fr_6.5rem_6.5rem_auto] sm:items-center sm:gap-2 sm:border-0 sm:bg-transparent sm:p-0"
          >
            <div className="flex items-center gap-2 sm:contents">
              <input
                value={item.description}
                onChange={(e) => setDescription(index, e.target.value)}
                list={listId}
                placeholder="Description of goods"
                className={`min-w-0 flex-1 px-3 sm:order-2 ${cell}`}
              />
              <div className="flex shrink-0 items-center gap-0.5 sm:order-5">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className="rounded-lg px-1.5 py-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Move line up"
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === items.length - 1}
                  className="rounded-lg px-1.5 py-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Move line down"
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="rounded-lg px-2 py-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Remove line"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:contents sm:mt-0">
              <input value={item.qty} onChange={(e) => patch(index, { qty: e.target.value })} placeholder="Qty" className={`sm:order-1 ${cell}`} />
              <input
                value={item.unitPrice}
                onChange={(e) => patch(index, { unitPrice: e.target.value })}
                inputMode="decimal"
                placeholder="Unit"
                className={`sm:order-3 ${cell} ${item.unitPrice && toPesewas(item.unitPrice) == null ? 'border-red-400' : ''}`}
              />
              <input
                value={item.amount}
                onChange={(e) => patch(index, { amount: e.target.value })}
                inputMode="decimal"
                placeholder="Amount (±)"
                title={item.auto ? 'Calculated from qty × unit price — type to override' : undefined}
                className={`sm:order-4 ${cell} ${item.auto && item.amount ? 'bg-slate-50 text-slate-600' : ''} ${
                  item.amount && toPesewas(item.amount) == null ? 'border-red-400' : ''
                }`}
              />
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onChange([...items, emptyItem()])} className="mt-3 text-sm font-medium text-teal-700 hover:underline">
        + Add line
      </button>
    </div>
  );
}
