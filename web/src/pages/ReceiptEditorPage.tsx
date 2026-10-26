import {
  computeTotals,
  formatDocNumber,
  PAYMENT_METHODS,
  RECEIPT_TEMPLATES,
  todayIso,
  toPesewas,
  type Customer,
  type PaymentMethod,
  type Receipt,
  type ReceiptInput,
  type ReceiptLayout,
} from '@olloo/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CustomerPicker } from '../components/CustomerPicker';
import { emptyCustomer, type CustomerDraft } from '../lib/catalog';
import { ErrorAlert } from '../components/ErrorAlert';
import { LineItemsEditor } from '../components/LineItemsEditor';
import { TotalsPanel } from '../components/TotalsPanel';
import { Button, Card, Field, Input, PageHeader, Select } from '../components/ui';
import { ReceiptDocument } from '../documents';
import { previewSnapshot } from '../documents/snapshot';
import { post } from '../lib/api';
import { blankItems, toDiscount, toLineItems, type DraftDiscount, type DraftItem } from '../lib/draft';
import { useAccount, useRefreshMe } from '../lib/session';

/** Standalone receipt: a walk-in sale (itemized) or money received (classic receipt book). */
export function ReceiptEditorPage() {
  const account = useAccount();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const refreshMe = useRefreshMe();
  const [layout, setLayout] = useState<ReceiptLayout>('classic');
  const [customer, setCustomer] = useState<CustomerDraft>(emptyCustomer);
  const [saveCustomer, setSaveCustomer] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [amountText, setAmountText] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [paymentFor, setPaymentFor] = useState('');
  const [items, setItems] = useState<DraftItem[]>(blankItems);
  const [discount, setDiscount] = useState<DraftDiscount>({ type: 'none', value: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const enabledTaxes = account.business.taxRates.filter((t) => t.enabled);
  const lineItems = toLineItems(items);
  const totals = computeTotals(lineItems, toDiscount(discount), enabledTaxes);
  const amount = layout === 'classic' ? (toPesewas(amountText) ?? 0) : totals.total;
  const counter = account.business.counters.receipt;
  const number = formatDocNumber(counter.prefix, counter.nextNumber, counter.pad);
  const snapshot = previewSnapshot(account);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!customer.customerName.trim()) return setError(new Error('Enter who the money was received from'));
    if (amount <= 0) return setError(new Error(layout === 'classic' ? 'Enter the amount received' : 'Add the items sold'));
    setSaving(true);
    setError(null);
    try {
      let customerId = customer.customerId;
      if (!customerId && saveCustomer) {
        customerId = (
          await post<Customer>('/customers', { name: customer.customerName, address: customer.customerAddress, phone: customer.customerPhone })
        ).id;
        qc.invalidateQueries({ queryKey: ['customers'] });
      }
      const common = { ...customer, customerId, date, method, reference, paymentFor };
      const body: ReceiptInput =
        layout === 'classic'
          ? { layout, ...common, amount }
          : { layout, ...common, items: lineItems.filter((i) => i.description), discount: toDiscount(discount) };
      const saved = await post<Receipt>('/receipts', body);
      qc.invalidateQueries({ queryKey: ['receipts'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      await refreshMe();
      navigate(`/receipts/${saved.id}`, { state: { fromPayment: true } });
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New receipt"
        subtitle={
          <>
            For money received against an invoice, open the invoice and use <strong>Record payment</strong>.
          </>
        }
        actions={
          <Link to="/receipts" className="text-sm font-medium text-teal-700 hover:underline">
            ← Back
          </Link>
        }
      />

      <Card>
        <form onSubmit={save} className="space-y-5">
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1 text-sm font-medium sm:max-w-md">
            {(
              [
                ['classic', 'Money received', 'Receipt-book style'],
                ['itemized', 'Sale with items', 'Lists what was bought'],
              ] as const
            ).map(([id, label, hint]) => (
              <button
                key={id}
                type="button"
                onClick={() => setLayout(id)}
                className={`rounded-md px-3 py-2 text-left transition ${layout === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {label}
                <span className="block text-xs font-normal text-slate-500">{hint}</span>
              </button>
            ))}
          </div>

          <CustomerPicker value={customer} onChange={setCustomer} saveNew={saveCustomer} onSaveNewChange={setSaveCustomer} />

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </Field>
            <Field label="Paid by">
              <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Reference (optional)">
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="MoMo ID, cheque no." />
            </Field>
          </div>

          {layout === 'classic' ? (
            <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
              <Field label="Amount (GH₵)">
                <Input value={amountText} onChange={(e) => setAmountText(e.target.value)} inputMode="decimal" placeholder="0.00" required />
              </Field>
              <Field label="Being payment for">
                <Input value={paymentFor} onChange={(e) => setPaymentFor(e.target.value)} placeholder="e.g. School fees, 2nd term" />
              </Field>
            </div>
          ) : (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Items sold</h3>
              <LineItemsEditor items={items} onChange={setItems} />
              <TotalsPanel discount={discount} onDiscountChange={setDiscount} totals={totals} taxesConfigured={enabledTaxes.length > 0} />
              <Field label="Note (optional)" className="mt-4">
                <Input value={paymentFor} onChange={(e) => setPaymentFor(e.target.value)} />
              </Field>
            </div>
          )}

          <ErrorAlert error={error} />
          <Button type="submit" loading={saving} className="w-full sm:w-auto">
            Save receipt
          </Button>
        </form>
      </Card>

      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Preview</p>
        <ReceiptDocument
          receipt={{
            id: 'draft',
            number,
            status: 'issued',
            layout,
            invoiceId: null,
            invoiceNumber: null,
            ...customer,
            date,
            method,
            reference,
            paymentFor,
            items: layout === 'itemized' ? lineItems : [],
            subtotal: layout === 'itemized' ? totals.subtotal : amount,
            discount: layout === 'itemized' ? toDiscount(discount) : { type: 'none', value: 0 },
            discountAmount: layout === 'itemized' ? totals.discountAmount : 0,
            taxes: layout === 'itemized' ? totals.taxes : [],
            amount,
            balanceAfter: null,
            voidReason: null,
            shareToken: null,
            snapshot,
            createdAt: '',
          }}
        />
        {snapshot.style.receiptTemplate !== 'receipt-book' && (
          <p className="mt-2 text-center text-xs text-slate-500">
            Using your {RECEIPT_TEMPLATES[snapshot.style.receiptTemplate].name} receipt template ·{' '}
            <Link to="/settings?tab=branding" className="text-teal-700 hover:underline">
              change
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
