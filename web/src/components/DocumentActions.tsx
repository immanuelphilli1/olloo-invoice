import { useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../lib/api';
import { downloadPdf } from '../utils/pdf';
import { printArea } from '../utils/capture';
import { shareDocumentImage, type ShareableDoc } from '../utils/shareImage';
import { Icon } from './icons';
import { Alert, Button, ProBadge } from './ui';

/** WhatsApp image, PDF and print for the document rendered in #doc-print-area. */
export function DocumentActions({ doc, size = 'md' }: { doc: ShareableDoc; size?: 'sm' | 'md' }) {
  const [busy, setBusy] = useState<'share' | 'pdf' | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  async function run(kind: 'share' | 'pdf') {
    const element = printArea();
    if (!element) return;
    setBusy(kind);
    setMessage(null);
    try {
      if (kind === 'share') {
        const result = await shareDocumentImage(element, doc);
        if (result === 'downloaded') {
          setMessage({ tone: 'success', text: `Downloaded ${doc.label.toLowerCase()}-${doc.number}.png — attach it in WhatsApp.` });
        }
      } else {
        await downloadPdf(element, `${doc.label.toLowerCase()}-${doc.number}.pdf`);
      }
    } catch (err) {
      setMessage({ tone: 'error', text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2 print:hidden">
      <div className="flex flex-wrap gap-2">
        <Button variant="whatsapp" size={size} loading={busy === 'share'} onClick={() => run('share')}>
          {busy !== 'share' && <Icon name="whatsapp" className="h-4 w-4" />}
          {busy === 'share' ? 'Preparing image…' : 'WhatsApp'}
        </Button>
        <Button variant="secondary" size={size} loading={busy === 'pdf'} onClick={() => run('pdf')}>
          {busy !== 'pdf' && <Icon name="download" className="h-4 w-4" />}
          PDF
        </Button>
        <Button variant="secondary" size={size} onClick={() => window.print()}>
          <Icon name="printer" className="h-4 w-4" />
          Print
        </Button>
      </div>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
    </div>
  );
}

/** Create / copy / revoke the public link. Pro only. */
export function ShareLink({
  token,
  allowed,
  onCreate,
  onRevoke,
}: {
  token: string | null;
  allowed: boolean;
  onCreate: () => Promise<unknown>;
  onRevoke: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const url = token ? `${window.location.origin}/d/${token}` : '';

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy — select the link and copy it manually.');
    }
  }

  if (!allowed) {
    return (
      <p className="flex flex-wrap items-center gap-2 text-sm text-slate-600 print:hidden">
        <Icon name="link" className="h-4 w-4" />
        Share a link customers can open in any browser
        <ProBadge />
        <Link to="/billing" className="font-medium text-teal-700 hover:underline">
          Upgrade
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-2 print:hidden">
      {token ? (
        <div className="flex flex-wrap items-center gap-2">
          <input readOnly value={url} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700" />
          <Button size="sm" variant="secondary" onClick={copy}>
            {copied ? 'Copied ✓' : 'Copy link'}
          </Button>
          <Button size="sm" variant="ghost" loading={busy} onClick={() => act(onRevoke)}>
            Turn off
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="secondary" loading={busy} onClick={() => act(onCreate)}>
          <Icon name="link" className="h-4 w-4" />
          Create share link
        </Button>
      )}
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}
