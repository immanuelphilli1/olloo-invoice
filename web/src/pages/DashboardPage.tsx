import { formatDisplayDate, formatGhs, type DashboardSummary } from '@olloo/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ErrorAlert } from '../components/ErrorAlert';
import { Alert, ButtonLink, Card, EmptyState, LoaderPage, PageHeader, StatTile, StatusBadge } from '../components/ui';
import { get } from '../lib/api';
import { useAccount } from '../lib/session';

export function DashboardPage() {
  const account = useAccount();
  const { data, isLoading, error } = useQuery({ queryKey: ['dashboard'], queryFn: () => get<DashboardSummary>('/dashboard') });
  const { entitlements, usage, subscription } = account;
  const limit = entitlements.monthlyDocLimit;
  const month = new Date().toLocaleString('en-GB', { month: 'long' });

  return (
    <div className="space-y-6">
      <PageHeader
        title={account.business.name}
        subtitle={`Here's ${month} so far.`}
        actions={
          <>
            <ButtonLink to="/receipts/new" variant="secondary">
              New receipt
            </ButtonLink>
            <ButtonLink to="/invoices/new">New invoice</ButtonLink>
          </>
        }
      />

      {subscription.paymentFailed && (
        <Alert tone="warning">
          Your last Pro payment didn't go through.{' '}
          <Link to="/billing" className="font-semibold underline">
            Renew now
          </Link>{' '}
          to keep Pro.
        </Alert>
      )}
      {limit != null && usage.docsThisMonth >= limit && (
        <Alert tone="warning">
          You've used all {limit} free documents this month. Existing documents still work.{' '}
          <Link to="/billing" className="font-semibold underline">
            Upgrade to Pro
          </Link>{' '}
          for unlimited.
        </Alert>
      )}

      <ErrorAlert error={error} />
      {isLoading || !data ? (
        <LoaderPage />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label={`Billed in ${month}`} value={formatGhs(data.billedThisMonth)} />
            <StatTile label={`Collected in ${month}`} value={formatGhs(data.collectedThisMonth)} />
            <StatTile label="Outstanding" value={formatGhs(data.outstanding)} sub={`${data.unpaidCount} unpaid invoice${data.unpaidCount === 1 ? '' : 's'}`} />
            <StatTile
              label="Documents this month"
              value={limit == null ? usage.docsThisMonth : `${usage.docsThisMonth} / ${limit}`}
              sub={limit == null ? 'Pro · unlimited' : 'Free plan'}
            />
          </div>

          <Card>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Recent</h2>
              {data.unpaidCount > 0 && (
                <Link to="/invoices" className="text-sm font-medium text-teal-700 hover:underline">
                  See unpaid invoices →
                </Link>
              )}
            </div>
            {data.recent.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="Nothing here yet"
                  body="Your latest invoices and receipts will show up here."
                  action={<ButtonLink to="/invoices/new">Create your first invoice</ButtonLink>}
                />
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {data.recent.map((d) => (
                  <li key={`${d.kind}-${d.id}`}>
                    <Link to={`/${d.kind}s/${d.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-slate-50">
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-slate-400 uppercase">{d.kind === 'invoice' ? 'INV' : 'RCT'}</span>
                          <span className="font-medium text-slate-900">№ {d.number}</span>
                          <StatusBadge status={d.status} kind={d.kind} />
                        </span>
                        <span className="block truncate text-sm text-slate-500">
                          {d.customerName} · {formatDisplayDate(d.date)}
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{formatGhs(d.amount)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
