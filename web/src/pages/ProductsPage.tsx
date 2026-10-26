import { formatGhs, pesewasToInput, toPesewas, type Product } from '@olloo/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { ErrorAlert } from '../components/ErrorAlert';
import { useProducts } from '../lib/catalog';
import { Button, Card, EmptyState, Field, Input, LoaderPage, PageHeader } from '../components/ui';
import { del, post, put } from '../lib/api';

export function ProductsPage() {
  const qc = useQueryClient();
  const { data: products = [], isLoading, error } = useProducts();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<unknown>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['products'] });

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await post('/products', { name, unitPrice: toPesewas(price) });
      setName('');
      setPrice('');
      await refresh();
    } catch (err) {
      setFormError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Products & services" subtitle="Your price list. Start typing a name in a line item to pick one." />
      <Card>
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cement (50kg bag)" required />
          </Field>
          <Field label="Unit price (GH₵)">
            <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="Optional" />
          </Field>
          <Button type="submit" loading={busy}>
            Add
          </Button>
        </form>
        <div className="mt-3">
          <ErrorAlert error={formError} />
        </div>
      </Card>
      <ErrorAlert error={error} />
      {isLoading ? (
        <LoaderPage />
      ) : products.length === 0 ? (
        <EmptyState title="No products yet" body="Add the things you sell most so you don't have to type prices every time." />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {products.map((p) => (
            <ProductRow key={p.id} product={p} onChanged={refresh} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ProductRow({ product, onChanged }: { product: Product; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(pesewasToInput(product.unitPrice));
  const [error, setError] = useState<unknown>(null);

  async function save() {
    try {
      await put(`/products/${product.id}`, { name, unitPrice: toPesewas(price), archived: false });
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err);
    }
  }

  async function remove() {
    if (!confirm(`Delete ${product.name}? Invoices that used it are not affected.`)) return;
    try {
      await del(`/products/${product.id}`);
      onChanged();
    } catch (err) {
      setError(err);
    }
  }

  return (
    <li className="px-4 py-3">
      {editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 flex-1" />
          <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className="w-32" />
          <Button size="sm" onClick={save}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate font-medium text-slate-900">{product.name}</span>
          <span className="flex shrink-0 items-center gap-1">
            <span className="mr-2 text-slate-700 tabular-nums">{product.unitPrice != null ? formatGhs(product.unitPrice) : '—'}</span>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" onClick={remove}>
              Delete
            </Button>
          </span>
        </div>
      )}
      <ErrorAlert error={error} />
    </li>
  );
}
