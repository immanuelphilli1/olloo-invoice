import {
  computeTotals,
  formatDocNumber,
  todayIso,
  type Customer,
  type Invoice,
  type InvoiceInput,
} from '@olloo/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CustomerPicker } from '../components/CustomerPicker';
import { customerToDraft, emptyCustomer, useCustomers, type CustomerDraft } from '../lib/catalog';
import { ErrorAlert } from '../components/ErrorAlert';
import { LineItemsEditor } from '../components/LineItemsEditor';
import { TotalsPanel } from '../components/TotalsPanel';
import { Alert, Button, Card, Field, Input, LoaderPage, PageHeader, Textarea } from '../components/ui';
import { ItemsDocument } from '../documents/ItemsDocument';
import { previewSnapshot } from '../documents/snapshot';
import { get, post, put } from '../lib/api';
import { blankItems, fromDiscount, fromLineItems, toDiscount, toLineItems, type DraftDiscount, type DraftItem } from '../lib/draft';
import { useAccount, useRefreshMe } from '../lib/session';

interface Draft {
  customer: CustomerDraft;
  lpoNo: string;
  date: string;
  dueDate: string;
  notes: string;
  items: DraftItem[];
  discount: DraftDiscount;
}

const blankDraft = (): Draft => ({
  customer: emptyCustomer(),
  lpoNo: '',
  date: todayIso(),
  dueDate: '',
  notes: '',
  items: blankItems(),
  discount: { type: 'none', value: '' },
});

function draftFromInvoice(inv: Invoice): Draft {
  return {
    customer: {
      customerId: inv.customerId,
      customerName: inv.customerName,
      customerAddress: inv.customerAddress,
      customerPhone: inv.customerPhone,
    },
    lpoNo: inv.lpoNo,
    date: inv.date,
    dueDate: inv.dueDate ?? '',
    notes: inv.notes,
    items: fromLineItems(inv.items),
    discount: fromDiscount(inv.discount),
  };
}

export function InvoiceEditorPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const editing = !!id;
  const existing = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => get<{ invoice: Invoice }>(`/invoices/${id}`),
    enabled: editing,
  });
  // /invoices/new?customer=<id> (from Customers or "New invoice" on an invoice) starts with that customer
  const presetId = editing ? null : params.get('customer');
  const customers = useCustomers();

  if (editing && existing.isLoading) return <LoaderPage />;
  if (editing && existing.error) return <ErrorAlert error={existing.error} />;
  if (presetId && customers.isLoading) return <LoaderPage />;
  const preset = presetId ? customers.data?.find((c) => c.id === presetId) : undefined;
  return <Editor key={id ?? `new-${presetId ?? ''}`} invoice={existing.data?.invoice} presetCustomer={preset} />;
}

function Editor({ invoice, presetCustomer }: { invoice?: Invoice; presetCustomer?: Customer }) {
  const account = useAccount();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const refreshMe = useRefreshMe();
  const [draft, setDraft] = useState<Draft>(() => {
    if (invoice) return draftFromInvoice(invoice);
    const blank = blankDraft();
    return presetCustomer ? { ...blank, customer: customerToDraft(presetCustomer) } : blank;
  });
  const [saveCustomer, setSaveCustomer] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const locked = invoice && (invoice.status === 'void' || invoice.amountPaid > 0);
  const enabledTaxes = account.business.taxRates.filter((t) => t.enabled);
  const items = toLineItems(draft.items);
  const discount = toDiscount(draft.discount);
  const totals = computeTotals(items, discount, enabledTaxes);
  const counter = account.business.counters.invoice;
  const number = invoice?.number ?? formatDocNumber(counter.prefix, counter.nextNumber, counter.pad);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft.customer.customerName.trim()) return setError(new Error("Enter the customer's name"));
    if (!items.some((i) => i.description)) return setError(new Error('Add at least one line item'));
    setSaving(true);
    setError(null);
    try {
      let customerId = draft.customer.customerId;
      if (!customerId && saveCustomer && !invoice) {
        const created = await post<Customer>('/customers', {
          name: draft.customer.customerName,
          address: draft.customer.customerAddress,
          phone: draft.customer.customerPhone,
        });
        customerId = created.id;
        qc.invalidateQueries({ queryKey: ['customers'] });
      }
      const body: InvoiceInput = {
        ...draft.customer,
        customerId,
        lpoNo: draft.lpoNo,
        date: draft.date,
        dueDate: draft.dueDate || null,
        notes: draft.notes,
        items: items.filter((i) => i.description),
        discount,
      };
      const saved = invoice ? await put<Invoice>(`/invoices/${invoice.id}`, body) : await post<Invoice>('/invoices', body);
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoice', saved.id] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      await refreshMe();
      navigate(`/invoices/${saved.id}`, { state: { justSaved: !invoice } });
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={invoice ? `Edit invoice № ${invoice.number}` : 'New invoice'}
        subtitle={invoice ? 'The number stays the same. You can edit until a payment is recorded.' : `This will be invoice № ${number}.`}
        actions={
          <Link to={invoice ? `/invoices/${invoice.id}` : '/invoices'} className="text-sm font-medium text-teal-700 hover:underline">
            ← Back
          </Link>
        }
      />

      {locked ? (
        <Alert tone="warning">
          {invoice.status === 'void' ? 'This invoice is void.' : 'This invoice has payments recorded, so it can no longer be edited.'}{' '}
          <Link to={`/invoices/${invoice.id}`} className="font-semibold underline">
            View invoice
          </Link>
        </Alert>
      ) : (
        <Card>
          <form onSubmit={save} className="space-y-5">
            <CustomerPicker
              value={draft.customer}
              onChange={(customer) => setDraft({ ...draft, customer })}
              saveNew={saveCustomer}
              onSaveNewChange={invoice ? undefined : setSaveCustomer}
              addressLabel="Address / Reg."
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Date">
                <Input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} required />
              </Field>
              <Field label="Due date (optional)">
                <Input type="date" value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} />
              </Field>
              <Field label="L.P.O. No. (optional)">
                <Input value={draft.lpoNo} onChange={(e) => setDraft({ ...draft, lpoNo: e.target.value })} />
              </Field>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Line items</h3>
              <LineItemsEditor items={draft.items} onChange={(next) => setDraft({ ...draft, items: next })} />
              <TotalsPanel
                discount={draft.discount}
                onDiscountChange={(d) => setDraft({ ...draft, discount: d })}
                totals={totals}
                taxesConfigured={enabledTaxes.length > 0}
              />
            </div>

            <Field label="Notes (optional)" hint="Payment details, terms, bank or MoMo number…">
              <Textarea rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </Field>

            <ErrorAlert error={error} />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={saving} className="w-full sm:w-auto">
                {invoice ? 'Save changes' : 'Save invoice'}
              </Button>
              {!invoice && (
                <Button variant="ghost" onClick={() => setDraft(blankDraft())} disabled={saving}>
                  Clear
                </Button>
              )}
            </div>
          </form>
        </Card>
      )}

      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase print:hidden">Preview</p>
        <ItemsDocument
          kind="invoice"
          snapshot={invoice?.snapshot ?? previewSnapshot(account)}
          number={number}
          customerName={draft.customer.customerName}
          customerAddress={draft.customer.customerAddress}
          customerPhone={draft.customer.customerPhone}
          lpoNo={draft.lpoNo}
          date={draft.date}
          dueDate={draft.dueDate || null}
          items={items}
          subtotal={totals.subtotal}
          discount={discount}
          discountAmount={totals.discountAmount}
          taxes={totals.taxes}
          total={totals.total}
          notes={draft.notes}
          showTotalStamp={totals.total !== 0}
        />
      </div>
    </div>
  );
}
