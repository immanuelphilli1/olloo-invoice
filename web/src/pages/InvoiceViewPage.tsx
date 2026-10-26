import {
  formatDisplayDate,
  formatGhs,
  PAYMENT_METHODS,
  pesewasToInput,
  todayIso,
  toPesewas,
  type Invoice,
  type PaymentMethod,
  type Receipt,
} from '@olloo/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { DocumentActions, ShareLink } from '../components/DocumentActions';
import { ErrorAlert } from '../components/ErrorAlert';
import { Alert, Button, ButtonLink, Card, Field, Input, LoaderPage, Modal, PageHeader, Select, StatusBadge } from '../components/ui';
import { VoidModal } from '../components/VoidModal';
import { InvoiceDocument } from '../documents';
import { del, get, post } from '../lib/api';
import { useAccount, useRefreshMe } from '../lib/session';

type InvoiceWithPayments = { invoice: Invoice; receipts: Receipt[] };

export function InvoiceViewPage() {
  const { id } = useParams();
  const account = useAccount();
  const location = useLocation();
  const qc = useQueryClient();
  const [paying, setPaying] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => get<InvoiceWithPayments>(`/invoices/${id}`),
  });

  if (isLoading) return <LoaderPage />;
  if (error || !data) return <ErrorAlert error={error} />;
  const { invoice, receipts } = data;
  const canEdit = invoice.status !== 'void' && invoice.amountPaid === 0;
  const canPay = invoice.status !== 'void' && invoice.balance > 0;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['invoice', id] });
    qc.invalidateQueries({ queryKey: ['invoices'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const setShareToken = (shareToken: string | null) =>
    qc.setQueryData<InvoiceWithPayments>(['invoice', id], (old) => old && { ...old, invoice: { ...old.invoice, shareToken } });

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            Invoice № {invoice.number} <StatusBadge status={invoice.status} />
          </span>
        }
        subtitle={`${invoice.customerName} · ${formatDisplayDate(invoice.date)}`}
        actions={
          <Link to="/invoices" className="text-sm font-medium text-teal-700 hover:underline">
            ← All invoices
          </Link>
        }
      />

      {(location.state as { justSaved?: boolean } | null)?.justSaved && (
        <Alert tone="success">Invoice № {invoice.number} saved. Share it with your customer below.</Alert>
      )}
      {invoice.status === 'void' && <Alert tone="error">Voided: {invoice.voidReason}</Alert>}

      <Card className="space-y-4 print:hidden">
        <div className="grid gap-4 sm:grid-cols-3">
          <Amount label="Total" value={invoice.total} />
          <Amount label="Paid" value={invoice.amountPaid} />
          <Amount label="Balance" value={invoice.balance} strong={invoice.balance > 0} />
        </div>
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {canPay && <Button onClick={() => setPaying(true)}>Record payment</Button>}
          {canEdit && (
            <ButtonLink to={`/invoices/${invoice.id}/edit`} variant="secondary">
              Edit
            </ButtonLink>
          )}
          <ButtonLink to={`/invoices/new${invoice.customerId ? `?customer=${invoice.customerId}` : ''}`} variant="secondary">
            New invoice
          </ButtonLink>
          {invoice.status !== 'void' && invoice.amountPaid === 0 && (
            <Button variant="danger" onClick={() => setVoiding(true)}>
              Void
            </Button>
          )}
        </div>
        <DocumentActions
          doc={{
            label: 'Invoice',
            number: invoice.number,
            businessName: invoice.snapshot.company.name,
            customerName: invoice.customerName,
            customerPhone: invoice.customerPhone,
          }}
        />
        <ShareLink
          token={invoice.shareToken}
          allowed={account.entitlements.publicLinks}
          onCreate={async () => setShareToken((await post<{ shareToken: string }>(`/invoices/${invoice.id}/share`)).shareToken)}
          onRevoke={async () => {
            await del(`/invoices/${invoice.id}/share`);
            setShareToken(null);
          }}
        />
      </Card>

      {receipts.length > 0 && (
        <Card className="print:hidden">
          <h2 className="font-semibold text-slate-900">Payments</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {receipts.map((r) => (
              <li key={r.id}>
                <Link to={`/receipts/${r.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-slate-50">
                  <span className="min-w-0">
                    <span className={`font-medium ${r.status === 'void' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>№ {r.number}</span>
                    <span className="ml-2 text-sm text-slate-500">
                      {formatDisplayDate(r.date)} · {PAYMENT_METHODS.find((m) => m.id === r.method)?.label}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {r.status === 'void' && <StatusBadge status="void" kind="receipt" />}
                    <span className="tabular-nums">{formatGhs(r.amount)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div id="doc-print-area">
        <InvoiceDocument invoice={invoice} />
      </div>

      <PaymentModal key={invoice.balance} open={paying} invoice={invoice} onClose={() => setPaying(false)} onPaid={refresh} />
      <VoidModal
        open={voiding}
        label="invoice"
        onClose={() => setVoiding(false)}
        onVoid={async (reason) => {
          await post(`/invoices/${invoice.id}/void`, { reason });
          refresh();
        }}
      />
    </div>
  );
}

function Amount({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${strong ? 'text-amber-700' : 'text-slate-900'}`}>{formatGhs(value)}</p>
    </div>
  );
}

function PaymentModal({ open, invoice, onClose, onPaid }: { open: boolean; invoice: Invoice; onClose: () => void; onPaid: () => void }) {
  const navigate = useNavigate();
  const refreshMe = useRefreshMe();
  const [form, setForm] = useState({
    amount: pesewasToInput(invoice.balance),
    date: todayIso(),
    method: 'cash' as PaymentMethod,
    reference: '',
    paymentFor: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const amount = toPesewas(form.amount);

  async function submit() {
    if (!amount || amount <= 0) return setError(new Error('Enter the amount received'));
    setBusy(true);
    setError(null);
    try {
      const res = await post<{ receipt: Receipt }>(`/invoices/${invoice.id}/payments`, { ...form, amount });
      onPaid();
      await refreshMe();
      navigate(`/receipts/${res.receipt.id}`, { state: { fromPayment: true } });
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Record payment · № ${invoice.number}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Save & issue receipt
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">
        Balance due: <span className="font-semibold text-slate-900">{formatGhs(invoice.balance)}</span>. Part payments are fine — the receipt shows what's left.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Amount received (GH₵)">
          <Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} inputMode="decimal" autoFocus />
        </Field>
        <Field label="Date">
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </Field>
        <Field label="Paid by">
          <Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as PaymentMethod })}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reference (optional)" hint="MoMo transaction ID, cheque no.…">
          <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
        </Field>
        <Field label="Being payment for" className="sm:col-span-2">
          <Input value={form.paymentFor} onChange={(e) => setForm({ ...form, paymentFor: e.target.value })} placeholder={`Payment for invoice № ${invoice.number}`} />
        </Field>
      </div>
      <div className="mt-3">
        <ErrorAlert error={error} />
      </div>
    </Modal>
  );
}
