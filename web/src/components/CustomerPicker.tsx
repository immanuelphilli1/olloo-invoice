import { useState } from 'react';
import { customerToDraft, useCustomers, type CustomerDraft } from '../lib/catalog';
import { Field, Input } from './ui';

/** Name field with suggestions from saved customers; picking one fills address and phone. */
export function CustomerPicker({
  value,
  onChange,
  saveNew,
  onSaveNewChange,
  addressLabel = 'Address',
}: {
  value: CustomerDraft;
  onChange: (value: CustomerDraft) => void;
  saveNew?: boolean;
  onSaveNewChange?: (save: boolean) => void;
  addressLabel?: string;
}) {
  const { data: customers = [] } = useCustomers();
  const [open, setOpen] = useState(false);
  const q = value.customerName.trim().toLowerCase();
  const matches = q ? customers.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)).slice(0, 6) : customers.slice(0, 6);
  const exact = customers.some((c) => c.name.toLowerCase() === q);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="relative sm:col-span-2">
        <Field label="Customer's name">
          <Input
            value={value.customerName}
            onChange={(e) => onChange({ ...value, customerName: e.target.value, customerId: null })}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Start typing to find a saved customer"
            autoComplete="off"
            required
          />
        </Field>
        {open && matches.length > 0 && !value.customerId && (
          <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
            {matches.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(customerToDraft(c));
                    setOpen(false);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-900">{c.name}</span>
                  {(c.phone || c.address) && <span className="ml-2 text-slate-500">{[c.phone, c.address].filter(Boolean).join(' · ')}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {value.customerId && <p className="mt-1 text-xs text-teal-700">Saved customer ✓</p>}
        {!value.customerId && q && !exact && onSaveNewChange && (
          <label className="mt-1 flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={!!saveNew} onChange={(e) => onSaveNewChange(e.target.checked)} className="accent-teal-600" />
            Save to my customers
          </label>
        )}
      </div>
      <Field label={addressLabel}>
        <Input value={value.customerAddress} onChange={(e) => onChange({ ...value, customerAddress: e.target.value })} placeholder="e.g. Adum, Kumasi" />
      </Field>
      <Field label="Phone (for WhatsApp)">
        <Input value={value.customerPhone} onChange={(e) => onChange({ ...value, customerPhone: e.target.value })} type="tel" placeholder="024 123 4567" />
      </Field>
    </div>
  );
}
