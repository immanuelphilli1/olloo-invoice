import { formatCedi, formatDisplayDate, FREE_MONTHLY_DOC_LIMIT, PRO_PRICE, type BillingInterval, type SubscriptionInfo } from '@olloo/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ErrorAlert } from '../components/ErrorAlert';
import { Alert, Badge, Button, ButtonLink, Card, Field, Input, LoaderPage, Modal, PageHeader } from '../components/ui';
import { get, post } from '../lib/api';
import { useAccount, useRefreshMe } from '../lib/session';

const cedis = (p: number) => formatCedi(p).replace(/\.00$/, '');

export function BillingPage() {
  const account = useAccount();
  const refreshMe = useRefreshMe();
  const { subscription: sub, entitlements, usage } = account;
  const pro = entitlements.plan === 'pro';
  const [checkout, setCheckout] = useState<BillingInterval | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function cancelAutoRenew() {
    if (!confirm('Stop automatic renewal? Pro stays on until the end of the period you have paid for.')) return;
    setCancelling(true);
    setError(null);
    try {
      await post<SubscriptionInfo>('/billing/cancel');
      await refreshMe();
    } catch (err) {
      setError(err);
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Plan & billing" />
      <ErrorAlert error={error} />

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">Current plan</p>
            <p className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-900">
              {pro ? 'Pro' : 'Free'}
              {sub.comp && <Badge tone="teal">Complimentary</Badge>}
            </p>
            {pro && !sub.comp && sub.currentPeriodEnd && (
              <p className="mt-1 text-sm text-slate-600">
                {sub.autoRenew
                  ? `Renews automatically on ${formatDisplayDate(sub.currentPeriodEnd)}.`
                  : `Paid until ${formatDisplayDate(sub.currentPeriodEnd)}. Renew before then to keep Pro.`}
              </p>
            )}
            {!pro && (
              <p className="mt-1 text-sm text-slate-600">
                {usage.docsThisMonth} of {FREE_MONTHLY_DOC_LIMIT} documents used this month.
                {sub.currentPeriodEnd && ` Your Pro plan ended on ${formatDisplayDate(sub.currentPeriodEnd)} — your documents are all still here.`}
              </p>
            )}
          </div>
          {pro && sub.autoRenew && (
            <Button variant="secondary" size="sm" onClick={cancelAutoRenew} loading={cancelling}>
              Stop auto-renew
            </Button>
          )}
        </div>
        {sub.paymentFailed && (
          <Alert tone="warning" className="mt-4">
            Your last automatic payment failed. Pay below to keep Pro.
          </Alert>
        )}
      </Card>

      {!sub.comp && (
        <div className="grid gap-4 md:grid-cols-2">
          <PlanCard
            title="Pro monthly"
            price={`GH₵ ${cedis(PRO_PRICE.monthly)}`}
            period="per month"
            action={pro ? 'Add a month' : 'Upgrade monthly'}
            onSelect={() => setCheckout('monthly')}
          />
          <PlanCard
            title="Pro yearly"
            price={`GH₵ ${cedis(PRO_PRICE.yearly)}`}
            period="per year — 2 months free"
            action={pro ? 'Add a year' : 'Upgrade yearly'}
            onSelect={() => setCheckout('yearly')}
            highlight
          />
        </div>
      )}

      <Card className="text-sm text-slate-600">
        <h2 className="font-semibold text-slate-900">How payment works</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Payments go through Paystack. Pay with MTN MoMo, Telecel Cash, AirtelTigo Money or a card.</li>
          <li>
            <strong>Card</strong> payments renew automatically. <strong>Mobile Money</strong> can't be charged automatically, so we'll send you an SMS a
            few days before your plan ends with a link to pay again.
          </li>
          <li>Paying early adds the time to the end of your current period — you never lose days.</li>
          <li>If Pro ends you go back to Free. Nothing is deleted.</li>
        </ul>
      </Card>

      {checkout && <CheckoutModal interval={checkout} defaultEmail={account.user.email ?? account.business.email} onClose={() => setCheckout(null)} />}
    </div>
  );
}

function PlanCard({
  title,
  price,
  period,
  action,
  onSelect,
  highlight,
}: {
  title: string;
  price: string;
  period: string;
  action: string;
  onSelect: () => void;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl bg-white p-6 shadow-sm ${highlight ? 'border-2 border-teal-600' : 'border border-slate-200'}`}>
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{price}</p>
      <p className="text-sm text-slate-500">{period}</p>
      <ul className="mt-4 space-y-1 text-sm text-slate-600">
        <li>✓ Unlimited invoices & receipts</li>
        <li>✓ All templates, no watermark</li>
        <li>✓ Share links</li>
      </ul>
      <Button className="mt-5 w-full" variant={highlight ? 'primary' : 'secondary'} onClick={onSelect}>
        {action}
      </Button>
    </div>
  );
}

function CheckoutModal({ interval, defaultEmail, onClose }: { interval: BillingInterval; defaultEmail: string | null; onClose: () => void }) {
  const [email, setEmail] = useState(defaultEmail ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const { authorizationUrl } = await post<{ authorizationUrl: string }>('/billing/checkout', { interval, email: email || undefined });
      window.location.href = authorizationUrl;
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Pay GH₵ ${cedis(PRO_PRICE[interval])} for ${interval === 'yearly' ? 'a year' : 'a month'} of Pro`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={go} loading={busy} disabled={!email}>
            Continue to Paystack
          </Button>
        </>
      }
    >
      <Field label="Email for your payment receipt" hint="Paystack needs an email address, even for Mobile Money.">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      </Field>
      <div className="mt-3">
        <ErrorAlert error={error} />
      </div>
    </Modal>
  );
}

/** Paystack redirects here with ?reference=… after checkout. */
export function BillingReturnPage() {
  const [params] = useSearchParams();
  const refreshMe = useRefreshMe();
  const reference = params.get('reference') ?? params.get('trxref') ?? '';
  const { data, error, isLoading } = useQuery({
    queryKey: ['billing-verify', reference],
    queryFn: async () => {
      const res = await get<{ status: string; subscription: SubscriptionInfo }>(`/billing/verify?reference=${encodeURIComponent(reference)}`);
      await refreshMe();
      return res;
    },
    enabled: !!reference,
    retry: false,
  });

  if (!reference) return <Alert tone="error">Missing payment reference.</Alert>;
  if (isLoading) return <LoaderPage label="Confirming your payment…" />;

  return (
    <div className="mx-auto max-w-lg space-y-4 py-10 text-center">
      {data?.subscription.plan === 'pro' ? (
        <>
          <p className="text-4xl">🎉</p>
          <h1 className="text-2xl font-bold text-slate-900">You're on Pro</h1>
          <p className="text-slate-600">
            Thank you! Pro is active until {formatDisplayDate(data.subscription.currentPeriodEnd)}. All templates are unlocked and the watermark is gone.
          </p>
          <div className="flex justify-center gap-2">
            <ButtonLink to="/settings?tab=branding" variant="secondary">
              Try the templates
            </ButtonLink>
            <ButtonLink to="/invoices/new">New invoice</ButtonLink>
          </div>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-slate-900">Payment not confirmed yet</h1>
          <p className="text-slate-600">
            {error
              ? 'We could not confirm this payment.'
              : `Paystack says the payment is "${data?.status ?? 'pending'}". MoMo payments can take a minute — this page will update when you refresh.`}
          </p>
          <ErrorAlert error={error} />
          <Link to="/billing" className="font-medium text-teal-700 hover:underline">
            Back to billing
          </Link>
        </>
      )}
    </div>
  );
}
