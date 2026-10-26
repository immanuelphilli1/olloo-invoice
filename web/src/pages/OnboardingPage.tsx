import { TEMPLATES, type Business, type Me, type TemplateId } from '@olloo/shared';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AssetUploader } from '../components/AssetUploader';
import { BusinessForm } from '../components/BusinessForm';
import { EMPTY_BUSINESS } from '../lib/forms';
import { Logo } from '../components/icons';
import { TemplatePicker } from '../components/TemplatePicker';
import { Alert, Button, Card, LoaderPage } from '../components/ui';
import { previewSnapshot } from '../documents/snapshot';
import { errorMessage, post, put } from '../lib/api';
import { useMe, useRefreshMe, useSetMe, type Account } from '../lib/session';

const STEPS = ['Business details', 'Logo & signature', 'Pick a look'];

export function OnboardingPage() {
  const { data: me } = useMe();
  const setMe = useSetMe();
  const [step, setStep] = useState(() => (me?.business ? 1 : 0));
  if (!me) return <LoaderPage />;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <Logo />
        <h1 className="mt-6 text-2xl font-bold text-slate-900 sm:text-3xl">
          {me.user.name ? `Welcome, ${me.user.name.split(' ')[0]}` : 'Welcome'} — let's set up your business
        </h1>
        <ol className="mt-4 flex flex-wrap gap-2 text-sm">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={`rounded-full px-3 py-1 font-medium ${
                i === step ? 'bg-teal-600 text-white' : i < step ? 'bg-teal-100 text-teal-800' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {i + 1}. {label}
            </li>
          ))}
        </ol>

        <div className="mt-6">
          {step === 0 && (
            <Card>
              <BusinessForm
                initial={EMPTY_BUSINESS}
                submitLabel="Continue"
                onSubmit={async (values) => {
                  setMe(await post<Me>('/business', values));
                  setStep(1);
                }}
              />
            </Card>
          )}
          {step === 1 && me.business && <AssetsStep business={me.business} onNext={() => setStep(2)} />}
          {step === 2 && me.business && <TemplateStep account={me as Account} />}
        </div>
      </div>
    </div>
  );
}

function AssetsStep({ business, onNext }: { business: Business; onNext: () => void }) {
  return (
    <Card className="space-y-6">
      <div>
        <h2 className="font-semibold text-slate-900">Logo</h2>
        <p className="mb-3 text-sm text-slate-500">Optional. Appears above your business name.</p>
        <AssetUploader kind="logo" business={business} />
      </div>
      <div>
        <h2 className="font-semibold text-slate-900">Signature</h2>
        <p className="mb-3 text-sm text-slate-500">Printed on the signature line, so you don't have to sign every document.</p>
        <AssetUploader kind="signature" business={business} />
      </div>
      <div className="flex gap-2">
        <Button onClick={onNext}>Continue</Button>
        <Button variant="ghost" onClick={onNext}>
          Skip for now
        </Button>
      </div>
    </Card>
  );
}

function TemplateStep({ account }: { account: Account }) {
  const navigate = useNavigate();
  const refreshMe = useRefreshMe();
  const [template, setTemplate] = useState<TemplateId>(account.business.style.template);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function finish() {
    setBusy(true);
    setError('');
    try {
      if (template !== account.business.style.template) await put('/business/style', TEMPLATES[template].preset);
      await refreshMe();
      navigate('/invoices/new', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4">
      <p className="text-sm text-slate-600">
        You can change colours, fonts and rows per page any time in Settings → Branding.
        {!account.entitlements.templates && (
          <>
            {' '}
            Clean Modern and Minimal Mono come with{' '}
            <Link to="/billing" className="font-medium text-teal-700 hover:underline">
              Pro
            </Link>
            .
          </>
        )}
      </p>
      <TemplatePicker value={template} onChange={setTemplate} baseSnapshot={previewSnapshot(account)} templatesAllowed={account.entitlements.templates} />
      <Alert tone="error">{error}</Alert>
      <Button onClick={finish} loading={busy}>
        Create my first invoice
      </Button>
    </Card>
  );
}
