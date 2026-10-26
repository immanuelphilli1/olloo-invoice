import type { BusinessInput } from '@olloo/shared';
import { useState, type FormEvent } from 'react';
import { Alert, Button, Field, Input } from './ui';

export function BusinessForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial: Required<BusinessInput>;
  submitLabel: string;
  onSubmit: (values: Required<BusinessInput>) => Promise<unknown>;
}) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const set = (key: keyof BusinessInput) => (e: { target: { value: string } }) => {
    setForm({ ...form, [key]: e.target.value });
    setSaved(false);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSubmit(form);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Business name" hint="Printed at the top of every invoice and receipt.">
        <Input value={form.name} onChange={set('name')} placeholder="e.g. S. A. Asiamah Enterprise" required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Location / address">
          <Input value={form.location} onChange={set('location')} placeholder="Amasaman Stadium Road" />
        </Field>
        <Field label="P.O. Box">
          <Input value={form.poBox} onChange={set('poBox')} placeholder="P.O. Box AT 115, Accra" />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={set('phone')} placeholder="(+233) 20 813 1942" type="tel" />
        </Field>
        <Field label="Email">
          <Input value={form.email} onChange={set('email')} type="email" placeholder="sales@yourbusiness.com" />
        </Field>
        <Field label="TIN (optional)" hint="Shown on documents when filled in.">
          <Input value={form.tin} onChange={set('tin')} placeholder="C0001234567" />
        </Field>
        <Field label="Footer note" hint="Printed at the bottom of documents.">
          <Input value={form.footerText} onChange={set('footerText')} />
        </Field>
      </div>
      <Alert tone="error">{error}</Alert>
      <div className="flex items-center gap-3">
        <Button type="submit" loading={busy}>
          {submitLabel}
        </Button>
        {saved && <span className="text-sm text-teal-700">Saved ✓</span>}
      </div>
    </form>
  );
}
