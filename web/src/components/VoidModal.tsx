import { useState } from 'react';
import { errorMessage } from '../lib/api';
import { Alert, Button, Field, Input, Modal } from './ui';

/** Ask for a reason, then void. Voided documents keep their number and stay listed. */
export function VoidModal({
  open,
  label,
  onClose,
  onVoid,
}: {
  open: boolean;
  label: string;
  onClose: () => void;
  onVoid: (reason: string) => Promise<unknown>;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await onVoid(reason);
      setReason('');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Void ${label}?`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep it
          </Button>
          <Button variant="danger" onClick={submit} loading={busy} disabled={!reason.trim()}>
            Void {label}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">
        It stays in your records marked VOID and its number is never reused. This can't be undone.
      </p>
      <Field label="Reason" className="mt-4">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Wrong customer, issued twice" autoFocus />
      </Field>
      <Alert tone="error" className="mt-3">
        {error}
      </Alert>
    </Modal>
  );
}
