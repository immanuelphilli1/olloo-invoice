import type { PublicDocument } from '@olloo/shared';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { DocumentActions } from '../components/DocumentActions';
import { ErrorAlert } from '../components/ErrorAlert';
import { Logo } from '../components/icons';
import { LoaderPage } from '../components/ui';
import { InvoiceDocument, ReceiptDocument } from '../documents';
import { get } from '../lib/api';

/** /d/:token — what a customer sees when they open a share link. No login. */
export function PublicDocumentPage() {
  const { token } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ['public', token],
    queryFn: () => get<PublicDocument>(`/public/${token}`),
  });

  const doc = data?.invoice ?? data?.receipt;
  const label = data?.kind === 'invoice' ? 'Invoice' : 'Receipt';

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-180 space-y-4">
        {isLoading && <LoaderPage />}
        {error && (
          <div className="rounded-xl bg-white p-6 text-center">
            <ErrorAlert error={error} />
            <p className="mt-3 text-sm text-slate-500">The link may have been turned off by the business that sent it.</p>
          </div>
        )}
        {doc && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
              <p className="text-sm text-slate-600">
                {label} № <span className="font-semibold text-slate-900">{doc.number}</span> from {doc.snapshot.company.name}
              </p>
              <DocumentActions
                size="sm"
                doc={{ label, number: doc.number, businessName: doc.snapshot.company.name, customerName: doc.customerName }}
              />
            </div>
            <div id="doc-print-area">{data?.invoice ? <InvoiceDocument invoice={data.invoice} /> : data?.receipt && <ReceiptDocument receipt={data.receipt} />}</div>
          </>
        )}
        <p className="pt-4 text-center text-xs text-slate-500 print:hidden">
          <Link to="/" className="inline-flex items-center gap-1 hover:text-slate-700">
            Sent with <Logo className="scale-75" />
          </Link>
        </p>
      </div>
    </div>
  );
}
