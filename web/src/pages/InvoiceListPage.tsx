import { formatDisplayDate, formatGhs, todayIso, type Invoice } from '@olloo/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorAlert } from '../components/ErrorAlert';
import { ListFilters } from '../components/ListFilters';
import { emptyFilters, hasFilters, useDebounced } from '../lib/filters';
import { Button, ButtonLink, EmptyState, LoaderPage, PageHeader, StatusBadge } from '../components/ui';
import { errorMessage, get, qs } from '../lib/api';
import { exportInvoicesToExcel } from '../utils/exportExcel';

const STATUSES = [
  { id: 'issued,part_paid', label: 'Unpaid' },
  { id: 'paid', label: 'Paid' },
  { id: 'void', label: 'Void' },
];

export function InvoiceListPage() {
  const [filters, setFilters] = useState(emptyFilters);
  const debounced = useDebounced(filters);
  const [exporting, setExporting] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ['invoices', debounced],
    queryFn: () => get<Invoice[]>(`/invoices${qs({ ...debounced })}`),
    placeholderData: keepPreviousData,
  });

  async function exportExcel() {
    setExporting(true);
    try {
      const all = await get<Invoice[]>(`/invoices${qs({ ...debounced, limit: 5000 })}`);
      await exportInvoicesToExcel(all, `invoices-${todayIso()}.xlsx`);
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        actions={
          <>
            <Button variant="secondary" onClick={exportExcel} loading={exporting} disabled={!data?.length}>
              Export Excel
            </Button>
            <ButtonLink to="/invoices/new">New invoice</ButtonLink>
          </>
        }
      />
      <ListFilters value={filters} onChange={setFilters} statuses={STATUSES} />
      <ErrorAlert error={error} />
      {isLoading ? (
        <LoaderPage />
      ) : !data?.length ? (
        <EmptyState
          title={hasFilters(filters) ? 'No invoices match' : 'No invoices yet'}
          body={hasFilters(filters) ? 'Try a different search or date range.' : 'Create your first invoice — it takes about a minute.'}
          action={!hasFilters(filters) && <ButtonLink to="/invoices/new">New invoice</ButtonLink>}
        />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {data.map((inv) => (
            <li key={inv.id}>
              <Link to={`/invoices/${inv.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className={`font-semibold ${inv.status === 'void' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>№ {inv.number}</span>
                    <StatusBadge status={inv.status} />
                  </p>
                  <p className="mt-0.5 truncate text-sm text-slate-600">
                    {inv.customerName} · {formatDisplayDate(inv.date)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold text-slate-900 tabular-nums">{formatGhs(inv.total)}</p>
                  {inv.status === 'part_paid' && <p className="text-xs text-amber-700 tabular-nums">{formatGhs(inv.balance)} due</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
