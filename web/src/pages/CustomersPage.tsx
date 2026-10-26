import type { Customer, CustomerInput } from '@olloo/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useCustomers } from '../lib/catalog';
import { ErrorAlert } from '../components/ErrorAlert';
import { Button, ButtonLink, EmptyState, Field, Input, inputClass, LoaderPage, Modal, PageHeader } from '../components/ui';
import { del, post, put } from '../lib/api';

const emptyForm: Required<CustomerInput> = { name: '', address: '', phone: '', email: '' };

export function CustomersPage() {
  const qc = useQueryClient();
  const { data: customers = [], isLoading, error } = useCustomers();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Customer | 'new' | null>(null);
  const q = search.trim().toLowerCase();
  const shown = q ? customers.filter((c) => [c.name, c.phone, c.address].some((v) => v.toLowerCase().includes(q))) : customers;

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" subtitle="Saved customers fill in automatically on invoices and receipts." actions={<Button onClick={() => setEditing('new')}>Add customer</Button>} />
      <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone or address" className={`${inputClass} sm:max-w-sm`} />
      <ErrorAlert error={error} />
      {isLoading ? (
        <LoaderPage />
      ) : shown.length === 0 ? (
        <EmptyState
          title={q ? 'No customers match' : 'No saved customers yet'}
          body={q ? undefined : "Tick 'Save to my customers' when you create an invoice, or add one here."}
        />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {shown.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <button type="button" className="min-w-0 text-left" onClick={() => setEditing(c)}>
                <p className="font-semibold text-slate-900">{c.name}</p>
                <p className="truncate text-sm text-slate-500">{[c.phone, c.address, c.email].filter(Boolean).join(' · ') || 'No contact details'}</p>
              </button>
              <div className="flex gap-2">
                <ButtonLink to={`/invoices/new?customer=${c.id}`} variant="secondary" size="sm">
                  New invoice
                </ButtonLink>
                <Button variant="ghost" size="sm" onClick={() => setEditing(c)}>
                  Edit
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <CustomerModal
          customer={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['customers'] });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function CustomerModal({ customer, onClose, onSaved }: { customer: Customer | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Required<CustomerInput>>(customer ? { name: customer.name, address: customer.address, phone: customer.phone, email: customer.email } : emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onSaved();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={customer ? 'Edit customer' : 'Add customer'}
      footer={
        <>
          {customer && (
            <Button
              variant="danger"
              className="mr-auto"
              disabled={busy}
              onClick={() => confirm(`Delete ${customer.name}? Their past invoices and receipts are kept.`) && run(() => del(`/customers/${customer.id}`))}
            >
              Delete
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => run(() => (customer ? put(`/customers/${customer.id}`, form) : post('/customers', form)))}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} type="tel" />
        </Field>
        <Field label="Email">
          <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </Field>
      </div>
      <div className="mt-3">
        <ErrorAlert error={error} />
      </div>
    </Modal>
  );
}
