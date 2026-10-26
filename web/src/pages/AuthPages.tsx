import type { Me } from '@olloo/shared';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Logo } from '../components/icons';
import { Alert, Button, Field, Input } from '../components/ui';
import { errorMessage, post } from '../lib/api';
import { useSetMe } from '../lib/session';

function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <Link to="/" className="mb-8">
        <Logo />
      </Link>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="mt-6 text-sm text-slate-600">{footer}</div>}
    </div>
  );
}

/** After login: go back where the user was headed, or onboarding for new accounts. */
function useAfterLogin() {
  const setMe = useSetMe();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return (me: Me) => {
    const next = params.get('next');
    const target = !me.business ? '/onboarding' : next?.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
    navigate(target, { replace: true });
    setMe(me);
  };
}

function Tabs({ value, onChange }: { value: 'phone' | 'email'; onChange: (v: 'phone' | 'email') => void }) {
  return (
    <div className="mb-5 grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-medium">
      {(['phone', 'email'] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={`rounded-md py-2 transition ${value === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
        >
          {tab === 'phone' ? 'Phone number' : 'Email'}
        </button>
      ))}
    </div>
  );
}

function PhoneForm({ askName }: { askName: boolean }) {
  const afterLogin = useAfterLogin();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function requestCode(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await post<{ phone: string }>('/auth/otp/request', { phone });
      setSentTo(res.phone);
      setStep('code');
      setCooldown(30);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      afterLogin(await post<Me>('/auth/otp/verify', { phone, code, name: name || undefined }));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (step === 'code') {
    return (
      <form onSubmit={verify} className="space-y-4">
        <p className="text-sm text-slate-600">
          We sent a 6-digit code to <span className="font-semibold text-slate-900">{sentTo}</span>.
        </p>
        <Field label="Code">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            className="text-center text-lg tracking-[0.5em]"
            autoFocus
          />
        </Field>
        <Alert tone="error">{error}</Alert>
        <Button type="submit" loading={busy} disabled={code.length !== 6} className="w-full">
          Continue
        </Button>
        <div className="flex justify-between text-sm">
          <button type="button" onClick={() => setStep('phone')} className="text-slate-600 hover:underline">
            Change number
          </button>
          <button type="button" disabled={cooldown > 0 || busy} onClick={() => requestCode()} className="font-medium text-teal-700 hover:underline disabled:text-slate-400 disabled:no-underline">
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={requestCode} className="space-y-4">
      {askName && (
        <Field label="Your name">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
        </Field>
      )}
      <Field label="Phone number" hint="We'll text you a code. Ghana numbers like 024 123 4567 work as-is.">
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="024 123 4567" required autoFocus />
      </Field>
      <Alert tone="error">{error}</Alert>
      <Button type="submit" loading={busy} className="w-full">
        Send code
      </Button>
    </form>
  );
}

function EmailLoginForm() {
  const afterLogin = useAfterLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [forgot, setForgot] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (forgot) {
        await post('/auth/password/reset-request', { email });
        setSent(true);
        setBusy(false);
      } else {
        afterLogin(await post<Me>('/auth/login', { email, password }));
      }
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (sent) {
    return <Alert tone="success">If {email} has an account, we've emailed a link to reset the password. It works for one hour.</Alert>;
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Email">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus />
      </Field>
      {!forgot && (
        <Field label="Password">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </Field>
      )}
      <Alert tone="error">{error}</Alert>
      <Button type="submit" loading={busy} className="w-full">
        {forgot ? 'Email me a reset link' : 'Log in'}
      </Button>
      <button type="button" onClick={() => setForgot((f) => !f)} className="text-sm text-teal-700 hover:underline">
        {forgot ? 'Back to log in' : 'Forgot password?'}
      </button>
    </form>
  );
}

function EmailSignupForm() {
  const afterLogin = useAfterLogin();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      afterLogin(await post<Me>('/auth/signup', form));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Your name">
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" required autoFocus />
      </Field>
      <Field label="Email">
        <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" required />
      </Field>
      <Field label="Password" hint="At least 8 characters.">
        <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" minLength={8} required />
      </Field>
      <Alert tone="error">{error}</Alert>
      <Button type="submit" loading={busy} className="w-full">
        Create account
      </Button>
    </form>
  );
}

export function LoginPage() {
  const [tab, setTab] = useState<'phone' | 'email'>('phone');
  return (
    <AuthLayout
      title="Log in"
      subtitle="Welcome back."
      footer={
        <>
          New to olloo?{' '}
          <Link to="/signup" className="font-semibold text-teal-700 hover:underline">
            Create a free account
          </Link>
        </>
      }
    >
      <Tabs value={tab} onChange={setTab} />
      {tab === 'phone' ? <PhoneForm askName={false} /> : <EmailLoginForm />}
    </AuthLayout>
  );
}

export function SignupPage() {
  const [tab, setTab] = useState<'phone' | 'email'>('phone');
  return (
    <AuthLayout
      title="Create your account"
      subtitle="Free for up to 10 invoices and receipts a month."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-teal-700 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <Tabs value={tab} onChange={setTab} />
      {tab === 'phone' ? <PhoneForm askName /> : <EmailSignupForm />}
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const afterLogin = useAfterLogin();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      afterLogin(await post<Me>('/auth/password/reset', { token, password }));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Choose a new password">
      {!token ? (
        <Alert tone="error">This link is incomplete. Open the link from the email again.</Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="New password" hint="At least 8 characters. You'll be logged out on other devices.">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required autoFocus />
          </Field>
          <Alert tone="error">{error}</Alert>
          <Button type="submit" loading={busy} className="w-full">
            Save password
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
