import type { Business } from '@olloo/shared';
import { useRef, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { useRefreshMe } from '../lib/session';
import { SignaturePad } from './SignaturePad';
import { Alert, Button } from './ui';

/** Upload (or, for signatures, draw) the business logo / signature. */
export function AssetUploader({ kind, business }: { kind: 'logo' | 'signature'; business: Business }) {
  const refreshMe = useRefreshMe();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [drawing, setDrawing] = useState(false);
  const current = kind === 'logo' ? business.logoUrl : business.signatureUrl;

  async function upload(file: Blob, name: string) {
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file, name);
      await api<Business>(`/business/assets/${kind}`, { method: 'POST', body: form });
      await refreshMe();
      setDrawing(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api(`/business/assets/${kind}`, { method: 'DELETE' });
      await refreshMe();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-20 w-40 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-[#f7f3e8]">
          {current ? (
            <img src={current} alt={kind} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-xs text-slate-400">No {kind}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file, file.name);
            }}
          />
          <Button size="sm" variant="secondary" loading={busy && !drawing} onClick={() => fileRef.current?.click()}>
            Upload image
          </Button>
          {kind === 'signature' && (
            <Button size="sm" variant="secondary" onClick={() => setDrawing((d) => !d)}>
              {drawing ? 'Cancel drawing' : 'Draw signature'}
            </Button>
          )}
          {current && (
            <Button size="sm" variant="ghost" onClick={remove} disabled={busy}>
              Remove
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-500">PNG, JPG or WebP, up to 1 MB.{kind === 'signature' && ' A photo of your signature on white paper works; a transparent PNG looks best.'}</p>
      {drawing && <SignaturePad ink={business.style.ink} saving={busy} onSave={(blob) => upload(blob, 'signature.png')} />}
      <Alert tone="error">{error}</Alert>
    </div>
  );
}
