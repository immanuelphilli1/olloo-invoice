import { formatDisplayDate, formatGhs, PAYMENT_METHODS, todayIso, type Receipt } from '@olloo/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorAlert } from '../components/ErrorAlert';
import { ListFilters } from '../components/ListFilters';
import { emptyFilters, hasFilters, useDebounced } from '../lib/filters';
import { Button, ButtonLink, EmptyState, LoaderPage, PageHeader, StatusBadge } from '../components/ui';
import { errorMessage, get, qs } from '../lib/api';
import { exportReceiptsToExcel } from '../utils/exportExcel';

const STATUSES = [
  { id: 'issued', label: 'Issued' },
  { id: 'void', label: 'Void' },
];

export function ReceiptListPage() {
  const [filters, setFilters] = useState(emptyFilters);
  const debounced = useDebounced(filters);
  const [exporting, setExporting] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ['receipts', debounced],
    queryFn: () => get<Receipt[]>(`/receipts${qs({ ...debounced })}`),
    placeholderData: keepPreviousData,
  });

  async function exportExcel() {
    setExporting(true);
    try {
      const all = await get<Receipt[]>(`/receipts${qs({ ...debounced, limit: 5000 })}`);
      await exportReceiptsToExcel(all, `receipts-${todayIso()}.xlsx`);
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Receipts"
        actions={
          <>
            <Button variant="secondary" onClick={exportExcel} loading={exporting} disabled={!data?.length}>
              Export Excel
            </Button>
            <ButtonLink to="/receipts/new">New receipt</ButtonLink>
          </>
        }
      />
      <ListFilters value={filters} onChange={setFilters} statuses={STATUSES} />
      <ErrorAlert error={error} />
      {isLoading ? (
        <LoaderPage />
      ) : !data?.length ? (
        <EmptyState
          title={hasFilters(filters) ? 'No receipts match' : 'No receipts yet'}
          body={
            hasFilters(filters)
              ? 'Try a different search or date range.'
              : 'Receipts appear here when you record a payment on an invoice, or issue one for a walk-in sale.'
          }
          action={!hasFilters(filters) && <ButtonLink to="/receipts/new">New receipt</ButtonLink>}
        />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {data.map((r) => (
            <li key={r.id}>
              <Link to={`/receipts/${r.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className={`font-semibold ${r.status === 'void' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>№ {r.number}</span>
                    {r.status === 'void' && <StatusBadge status="void" kind="receipt" />}
                    {r.invoiceNumber && <span className="text-xs text-slate-500">for {r.invoiceNumber}</span>}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-slate-600">
                    {r.customerName} · {formatDisplayDate(r.date)} · {PAYMENT_METHODS.find((m) => m.id === r.method)?.label}
                  </p>
                </div>
                <p className="shrink-0 font-semibold text-slate-900 tabular-nums">{formatGhs(r.amount)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
