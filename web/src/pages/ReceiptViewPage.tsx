import { formatDisplayDate, formatGhs, type Receipt } from '@olloo/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { DocumentActions, ShareLink } from '../components/DocumentActions';
import { ErrorAlert } from '../components/ErrorAlert';
import { Alert, Button, Card, LoaderPage, PageHeader, StatusBadge } from '../components/ui';
import { VoidModal } from '../components/VoidModal';
import { ReceiptDocument } from '../documents';
import { del, get, post } from '../lib/api';
import { useAccount } from '../lib/session';

export function ReceiptViewPage() {
  const { id } = useParams();
  const account = useAccount();
  const location = useLocation();
  const qc = useQueryClient();
  const [voiding, setVoiding] = useState(false);
  const { data: receipt, isLoading, error } = useQuery({
    queryKey: ['receipt', id],
    queryFn: () => get<Receipt>(`/receipts/${id}`),
  });

  if (isLoading) return <LoaderPage />;
  if (error || !receipt) return <ErrorAlert error={error} />;

  const setShareToken = (shareToken: string | null) => qc.setQueryData<Receipt>(['receipt', id], (old) => old && { ...old, shareToken });

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            Receipt № {receipt.number} <StatusBadge status={receipt.status} kind="receipt" />
          </span>
        }
        subtitle={`${receipt.customerName} · ${formatDisplayDate(receipt.date)} · ${formatGhs(receipt.amount)}`}
        actions={
          <Link to="/receipts" className="text-sm font-medium text-teal-700 hover:underline">
            ← All receipts
          </Link>
        }
      />

      {(location.state as { fromPayment?: boolean } | null)?.fromPayment && (
        <Alert tone="success">Receipt № {receipt.number} issued. Send it to your customer on WhatsApp below.</Alert>
      )}
      {receipt.status === 'void' && <Alert tone="error">Voided: {receipt.voidReason}</Alert>}

      <Card className="space-y-4 print:hidden">
        {receipt.invoiceId && (
          <p className="text-sm text-slate-600">
            Payment for{' '}
            <Link to={`/invoices/${receipt.invoiceId}`} className="font-semibold text-teal-700 hover:underline">
              invoice № {receipt.invoiceNumber}
            </Link>
            {receipt.balanceAfter != null && <> · balance after this payment {formatGhs(receipt.balanceAfter)}</>}
          </p>
        )}
        <DocumentActions
          doc={{
            label: 'Receipt',
            number: receipt.number,
            businessName: receipt.snapshot.company.name,
            customerName: receipt.customerName,
            customerPhone: receipt.customerPhone,
          }}
        />
        <ShareLink
          token={receipt.shareToken}
          allowed={account.entitlements.publicLinks}
          onCreate={async () => setShareToken((await post<{ shareToken: string }>(`/receipts/${receipt.id}/share`)).shareToken)}
          onRevoke={async () => {
            await del(`/receipts/${receipt.id}/share`);
            setShareToken(null);
          }}
        />
        {receipt.status !== 'void' && (
          <div className="border-t border-slate-100 pt-4">
            <Button variant="danger" size="sm" onClick={() => setVoiding(true)}>
              Void receipt
            </Button>
            {receipt.invoiceId && <p className="mt-1 text-xs text-slate-500">Voiding adds the amount back to the invoice balance.</p>}
          </div>
        )}
      </Card>

      <div id="doc-print-area">
        <ReceiptDocument receipt={receipt} />
      </div>

      <VoidModal
        open={voiding}
        label="receipt"
        onClose={() => setVoiding(false)}
        onVoid={async (reason) => {
          const updated = await post<Receipt>(`/receipts/${receipt.id}/void`, { reason });
          qc.setQueryData(['receipt', id], updated);
          qc.invalidateQueries({ queryKey: ['receipts'] });
          qc.invalidateQueries({ queryKey: ['dashboard'] });
          if (receipt.invoiceId) qc.invalidateQueries({ queryKey: ['invoice', receipt.invoiceId] });
        }}
      />
    </div>
  );
}
