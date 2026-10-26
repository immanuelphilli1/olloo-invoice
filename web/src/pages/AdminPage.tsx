import { formatDisplayDate } from '@olloo/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ErrorAlert } from '../components/ErrorAlert';
import { Badge, Button, inputClass, LoaderPage, PageHeader } from '../components/ui';
import { get, put } from '../lib/api';
import { useAccount } from '../lib/session';

interface AdminBusiness {
  id: string;
  name: string;
  ownerName: string;
  ownerEmail: string | null;
  ownerPhone: string | null;
  plan: 'free' | 'pro';
  comp: boolean;
  autoRenew: boolean;
  currentPeriodEnd: string | null;
  docsThisMonth: number;
  createdAt: string;
}

export function AdminPage() {
  const { user } = useAccount();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [error, setError] = useState<unknown>(null);
  const { data = [], isLoading, error: loadError } = useQuery({
    queryKey: ['admin-businesses'],
    queryFn: () => get<AdminBusiness[]>('/admin/businesses'),
    enabled: user.isSuperadmin,
  });

  if (!user.isSuperadmin) return <Navigate to="/dashboard" replace />;

  async function update(id: string, body: { comp?: boolean; extendMonths?: number }) {
    setError(null);
    try {
      await put(`/admin/businesses/${id}/subscription`, body);
      await qc.invalidateQueries({ queryKey: ['admin-businesses'] });
    } catch (err) {
      setError(err);
    }
  }

  const q = search.trim().toLowerCase();
  const rows = q
    ? data.filter((b) => [b.name, b.ownerName, b.ownerEmail, b.ownerPhone].some((v) => v?.toLowerCase().includes(q)))
    : data;
  const proCount = data.filter((b) => b.plan === 'pro').length;

  return (
    <div className="space-y-6">
      <PageHeader title="Admin" subtitle={`${data.length} businesses · ${proCount} on Pro`} />
      <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search business, owner, phone" className={`${inputClass} sm:max-w-sm`} />
      <ErrorAlert error={loadError ?? error} />
      {isLoading ? (
        <LoaderPage />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-200 text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3 text-right">Docs this month</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{b.name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {b.ownerName}
                    <span className="block text-xs text-slate-400">{[b.ownerEmail, b.ownerPhone].filter(Boolean).join(' · ')}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap items-center gap-1">
                      <Badge tone={b.plan === 'pro' ? 'teal' : 'slate'}>{b.plan === 'pro' ? 'Pro' : 'Free'}</Badge>
                      {b.comp && <Badge tone="blue">Comp</Badge>}
                      {b.autoRenew && <Badge>Auto-renew</Badge>}
                    </span>
                    {b.currentPeriodEnd && !b.comp && <span className="mt-0.5 block text-xs text-slate-400">until {formatDisplayDate(b.currentPeriodEnd)}</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{b.docsThisMonth}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDisplayDate(b.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className="flex justify-end gap-1">
                      <Button size="sm" variant="secondary" onClick={() => update(b.id, { extendMonths: 1 })}>
                        +1 month
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => update(b.id, { extendMonths: 12 })}>
                        +1 year
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => update(b.id, { comp: !b.comp })}>
                        {b.comp ? 'Remove comp' : 'Comp Pro'}
                      </Button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
