import {
  fontCss,
  FONT_OPTIONS,
  formatDocNumber,
  MAX_ROWS,
  MIN_ROWS,
  TEMPLATES,
  type Business,
  type CounterSettings,
  type DocumentStyle,
  type TaxRate,
} from '@olloo/shared';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AssetUploader } from '../components/AssetUploader';
import { BusinessForm } from '../components/BusinessForm';
import { ErrorAlert } from '../components/ErrorAlert';
import { ReceiptTemplatePicker, TemplatePicker } from '../components/TemplatePicker';
import { Alert, Button, Card, Field, Input, inputClass, PageHeader } from '../components/ui';
import { ReceiptDocument } from '../documents';
import { ItemsDocument } from '../documents/ItemsDocument';
import { previewSnapshot } from '../documents/snapshot';
import { useAllFonts } from '../documents/fonts';
import { sampleInvoiceProps, sampleReceipt } from '../documents/sample';
import { put } from '../lib/api';
import { useAccount, useRefreshMe, type Account } from '../lib/session';

const TABS = [
  { id: 'business', label: 'Business' },
  { id: 'branding', label: 'Branding' },
  { id: 'numbering', label: 'Numbering' },
  { id: 'taxes', label: 'Taxes' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export function SettingsPage() {
  const account = useAccount();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'business') as TabId;

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" />
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setParams({ tab: t.id })}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap ${
              tab === t.id ? 'border-teal-600 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'business' && <BusinessTab business={account.business} />}
      {tab === 'branding' && <BrandingTab account={account} />}
      {tab === 'numbering' && <NumberingTab business={account.business} />}
      {tab === 'taxes' && <TaxesTab business={account.business} />}
    </div>
  );
}

function BusinessTab({ business }: { business: Business }) {
  const refreshMe = useRefreshMe();
  return (
    <div className="space-y-6">
      <Card>
        <BusinessForm
          initial={{
            name: business.name,
            location: business.location,
            poBox: business.poBox,
            phone: business.phone,
            email: business.email,
            tin: business.tin,
            footerText: business.footerText,
          }}
          submitLabel="Save details"
          onSubmit={async (values) => {
            await put('/business', values);
            await refreshMe();
          }}
        />
        <p className="mt-4 text-xs text-slate-500">Changes apply to new documents. Documents already issued keep the details they were issued with.</p>
      </Card>
      <Card className="space-y-6">
        <div>
          <h2 className="font-semibold text-slate-900">Logo</h2>
          <div className="mt-3">
            <AssetUploader kind="logo" business={business} />
          </div>
        </div>
        <div>
          <h2 className="font-semibold text-slate-900">Signature</h2>
          <div className="mt-3">
            <AssetUploader kind="signature" business={business} />
          </div>
        </div>
      </Card>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-xs text-slate-500">{value}</span>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-slate-300 bg-white p-0.5" />
      </span>
    </label>
  );
}

function FontField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} style={{ fontFamily: fontCss(value) }}>
        {FONT_OPTIONS.map((f) => (
          <option key={f.family} value={f.family} style={{ fontFamily: f.css }}>
            {f.family}
          </option>
        ))}
      </select>
    </Field>
  );
}

function BrandingTab({ account }: { account: Account }) {
  useAllFonts();
  const refreshMe = useRefreshMe();
  const [style, setStyle] = useState<DocumentStyle>(account.business.style);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState<'invoice' | 'receipt' | 'sale'>('invoice');
  const set = <K extends keyof DocumentStyle>(key: K, value: DocumentStyle[K]) => {
    setStyle((s) => ({ ...s, [key]: value }));
    setSaved(false);
  };
  const dirty = JSON.stringify(style) !== JSON.stringify(account.business.style);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await put('/business/style', style);
      await refreshMe();
      setSaved(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const snapshot = previewSnapshot(account, style);

  return (
    <div className="space-y-6">
      {!account.entitlements.templates && (
        <Alert tone="info">
          Free accounts use Classic Ink invoices and Receipt Book receipts — colours, fonts and size can still be changed.{' '}
          <Link to="/billing" className="font-semibold text-teal-700 hover:underline">
            Pro
          </Link>{' '}
          unlocks every invoice and receipt template.
        </Alert>
      )}
      <Card>
        <h2 className="font-semibold text-slate-900">Invoice template</h2>
        <p className="mb-4 text-sm text-slate-500">Picking a template resets colours and fonts to its defaults.</p>
        <TemplatePicker
          value={style.template}
          onChange={(id) => {
            setStyle((s) => ({ ...TEMPLATES[id].preset, receiptTemplate: s.receiptTemplate }));
            setSaved(false);
          }}
          baseSnapshot={snapshot}
          templatesAllowed={account.entitlements.templates}
        />
      </Card>

      <Card>
        <h2 className="font-semibold text-slate-900">Receipt template</h2>
        <p className="mb-4 text-sm text-slate-500">
          Used for every new receipt. A receipt template from the same family as your invoice template uses your colours and fonts;
          the others bring their own look.
        </p>
        <ReceiptTemplatePicker
          value={style.receiptTemplate}
          onChange={(id) => {
            set('receiptTemplate', id);
            setPreview(id === 'till' ? 'sale' : 'receipt');
          }}
          baseSnapshot={snapshot}
          templatesAllowed={account.entitlements.templates}
        />
      </Card>

      <div className="grid gap-6 2xl:grid-cols-[22rem_1fr]">
        <Card className="space-y-5 2xl:sticky 2xl:top-6 2xl:self-start">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-800">Colours</h3>
            <ColorField label="Ink (filled-in text)" value={style.ink} onChange={(v) => set('ink', v)} />
            <ColorField label="Lines & accents" value={style.accent} onChange={(v) => set('accent', v)} />
            <ColorField label="Paper" value={style.paper} onChange={(v) => set('paper', v)} />
            <ColorField label="Shaded columns" value={style.shade} onChange={(v) => set('shade', v)} />
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">Fonts</h3>
            <FontField label="Headings" value={style.headingFont} onChange={(v) => set('headingFont', v)} />
            <FontField label="Labels" value={style.bodyFont} onChange={(v) => set('bodyFont', v)} />
            <FontField label="Filled-in values" value={style.inkFont} onChange={(v) => set('inkFont', v)} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Text size</h3>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium">
              {(['sm', 'md', 'lg'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set('fontScale', s)}
                  className={`rounded-md py-1.5 ${style.fontScale === s ? 'bg-white shadow-sm' : 'text-slate-600'}`}
                >
                  {s === 'sm' ? 'Small' : s === 'md' ? 'Medium' : 'Large'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-2 flex justify-between text-sm font-semibold text-slate-800">
              Lines per page <span className="tabular-nums">{style.rowsPerPage}</span>
            </h3>
            <input
              type="range"
              min={MIN_ROWS}
              max={MAX_ROWS}
              value={style.rowsPerPage}
              onChange={(e) => set('rowsPerPage', Number(e.target.value))}
              className="w-full accent-teal-600"
            />
            <p className="text-xs text-slate-500">More items than this continue on a new page with "P.T.O.".</p>
          </div>
          <ErrorAlert error={error} />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={save} loading={busy} disabled={!dirty}>
              Save branding
            </Button>
            <Button variant="ghost" onClick={() => setStyle((s) => ({ ...TEMPLATES[s.template].preset, receiptTemplate: s.receiptTemplate }))}>
              Reset to defaults
            </Button>
            {saved && !dirty && <span className="text-sm text-teal-700">Saved ✓</span>}
          </div>
        </Card>
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Live preview</p>
            <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-medium" role="tablist">
              {(
                [
                  ['invoice', 'Invoice'],
                  ['receipt', 'Payment receipt'],
                  ['sale', 'Shop sale'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={preview === id}
                  onClick={() => setPreview(id)}
                  className={`rounded-md px-3 py-1.5 ${preview === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {preview === 'invoice' ? (
            <ItemsDocument {...sampleInvoiceProps(snapshot)} />
          ) : (
            <ReceiptDocument receipt={sampleReceipt(snapshot, preview === 'sale' ? 'itemized' : 'classic')} />
          )}
        </div>
      </div>
    </div>
  );
}

function NumberingTab({ business }: { business: Business }) {
  const refreshMe = useRefreshMe();
  const [counters, setCounters] = useState(business.counters);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);

  const row = (kind: 'invoice' | 'receipt', label: string) => {
    const c = counters[kind];
    const set = (patch: Partial<CounterSettings>) => {
      setCounters({ ...counters, [kind]: { ...c, ...patch } });
      setSaved(false);
    };
    const lowered = c.nextNumber < business.counters[kind].nextNumber;
    return (
      <div className="space-y-3">
        <h3 className="font-semibold text-slate-900">{label}</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Prefix">
            <Input value={c.prefix} onChange={(e) => set({ prefix: e.target.value })} maxLength={12} />
          </Field>
          <Field label="Next number">
            <Input type="number" min={1} value={c.nextNumber} onChange={(e) => set({ nextNumber: Math.max(1, Number(e.target.value) || 1) })} />
          </Field>
          <Field label="Digits">
            <Input type="number" min={1} max={10} value={c.pad} onChange={(e) => set({ pad: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })} />
          </Field>
        </div>
        <p className="text-sm text-slate-600">
          Next {kind}: <span className="font-semibold text-slate-900">{formatDocNumber(c.prefix, c.nextNumber, c.pad)}</span>
        </p>
        {lowered && <Alert tone="warning">Numbers already used will be refused — olloo never issues the same number twice.</Alert>}
      </div>
    );
  };

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await put('/business/counters', counters);
      await refreshMe();
      setSaved(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-6">
      <p className="text-sm text-slate-600">Moving from a paper book? Set the next number to carry on where your book stopped.</p>
      {row('invoice', 'Invoices')}
      {row('receipt', 'Receipts')}
      <ErrorAlert error={error} />
      <div className="flex items-center gap-3">
        <Button onClick={save} loading={busy}>
          Save numbering
        </Button>
        {saved && <span className="text-sm text-teal-700">Saved ✓</span>}
      </div>
    </Card>
  );
}

function TaxesTab({ business }: { business: Business }) {
  const refreshMe = useRefreshMe();
  const [rates, setRates] = useState<Array<TaxRate & { rateText: string }>>(
    business.taxRates.map((t) => ({ ...t, rateText: String(t.rateBps / 100) }))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const update = (i: number, patch: Partial<TaxRate & { rateText: string }>) => {
    setRates(rates.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    setSaved(false);
  };

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body = rates.map(({ rateText, ...t }) => ({ ...t, rateBps: Math.round(Number(rateText) * 100) || 0 }));
      await put('/business/taxes', body);
      await refreshMe();
      setSaved(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4">
      <p className="text-sm text-slate-600">
        Switched-on taxes are added to every new invoice and itemized receipt, each charged on the total after discount. Check the current rates with
        your accountant or GRA — you can change them here any time.
      </p>
      <ul className="space-y-2">
        {rates.map((r, i) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={r.enabled} onChange={(e) => update(i, { enabled: e.target.checked })} className="h-4 w-4 accent-teal-600" />
              <span className="sr-only">Enabled</span>
            </label>
            <Input value={r.name} onChange={(e) => update(i, { name: e.target.value })} className="min-w-0 flex-1" aria-label="Tax name" />
            <div className="flex items-center gap-1">
              <Input value={r.rateText} onChange={(e) => update(i, { rateText: e.target.value })} inputMode="decimal" className="w-20 text-right" aria-label="Rate" />
              <span className="text-sm text-slate-500">%</span>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setRates(rates.filter((_, j) => j !== i))} aria-label="Remove tax">
              ×
            </Button>
          </li>
        ))}
      </ul>
      {rates.length < 8 && (
        <button
          type="button"
          onClick={() => setRates([...rates, { id: `custom-${Date.now()}`, name: 'Levy', rateBps: 0, rateText: '0', enabled: true }])}
          className="text-sm font-medium text-teal-700 hover:underline"
        >
          + Add a tax or levy
        </button>
      )}
      <ErrorAlert error={error} />
      <div className="flex items-center gap-3">
        <Button onClick={save} loading={busy}>
          Save taxes
        </Button>
        {saved && <span className="text-sm text-teal-700">Saved ✓</span>}
      </div>
    </Card>
  );
}
