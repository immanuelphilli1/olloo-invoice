import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { post } from '../lib/api';
import { useAccount } from '../lib/session';
import { Icon, Logo, type IconName } from './icons';
import { buttonClass } from './buttonClass';

const NAV: Array<{ to: string; label: string; icon: IconName }> = [
  { to: '/dashboard', label: 'Dashboard', icon: 'home' },
  { to: '/invoices', label: 'Invoices', icon: 'invoice' },
  { to: '/receipts', label: 'Receipts', icon: 'receipt' },
  { to: '/customers', label: 'Customers', icon: 'users' },
  { to: '/products', label: 'Products', icon: 'box' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
  { to: '/billing', label: 'Plan & billing', icon: 'card' },
];

function navClass({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-teal-50 text-teal-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`;
}

function PlanCard() {
  const { entitlements, usage } = useAccount();
  if (entitlements.plan === 'pro') {
    return (
      <div className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-sm">
        <p className="font-semibold text-teal-900">olloo Pro</p>
        <p className="text-xs text-teal-800">Unlimited documents</p>
      </div>
    );
  }
  const limit = entitlements.monthlyDocLimit ?? 0;
  const used = Math.min(usage.docsThisMonth, limit);
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-slate-800">Free plan</p>
        <p className="text-xs text-slate-500 tabular-nums">
          {used}/{limit} this month
        </p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${used >= limit ? 'bg-red-500' : 'bg-teal-500'}`} style={{ width: `${(used / Math.max(limit, 1)) * 100}%` }} />
      </div>
      <Link to="/billing" className="mt-2 inline-block text-xs font-semibold text-teal-700 hover:underline">
        Upgrade to Pro →
      </Link>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAccount();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => (
        <NavLink key={item.to} to={item.to} className={navClass} onClick={onNavigate}>
          <Icon name={item.icon} />
          {item.label}
        </NavLink>
      ))}
      {user.isSuperadmin && (
        <NavLink to="/admin" className={navClass} onClick={onNavigate}>
          <Icon name="shield" />
          Admin
        </NavLink>
      )}
    </nav>
  );
}

export function AppShell() {
  const account = useAccount();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  async function logout() {
    await post('/auth/logout').catch(() => undefined);
    qc.clear();
    navigate('/login');
  }

  const footer = (
    <div className="space-y-3">
      <PlanCard />
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="min-w-0 text-sm">
          <p className="truncate font-medium text-slate-800">{account.business.name}</p>
          <p className="truncate text-xs text-slate-500">{account.user.name || account.user.email || account.user.phone}</p>
        </div>
        <button type="button" onClick={logout} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800" title="Log out" aria-label="Log out">
          <Icon name="logout" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col justify-between border-r border-slate-200 bg-white p-4 lg:flex print:hidden">
        <div className="space-y-6">
          <Link to="/dashboard" className="block px-1">
            <Logo />
          </Link>
          <div className="flex gap-2">
            <Link to="/invoices/new" className={buttonClass('primary', 'sm', 'flex-1')}>
              + Invoice
            </Link>
            <Link to="/receipts/new" className={buttonClass('secondary', 'sm', 'flex-1')}>
              + Receipt
            </Link>
          </div>
          <NavLinks />
        </div>
        {footer}
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur lg:hidden print:hidden">
        <Link to="/dashboard">
          <Logo />
        </Link>
        <button type="button" onClick={() => setMenuOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Open menu">
          <Icon name="menu" />
        </button>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 lg:hidden" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col justify-between bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <NavLinks onNavigate={() => setMenuOpen(false)} />
            {footer}
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <main className="mx-auto max-w-6xl px-4 pt-6 pb-28 sm:px-6 lg:pb-10">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden">
        {NAV.slice(0, 2).map((item) => (
          <BottomLink key={item.to} {...item} />
        ))}
        <div className="relative flex items-center justify-center">
          <button
            type="button"
            onClick={() => setCreateOpen((v) => !v)}
            className="-mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-teal-600 text-white shadow-lg hover:bg-teal-700"
            aria-label="Create new"
          >
            <Icon name="plus" className="h-6 w-6" />
          </button>
          {createOpen && (
            <div className="absolute bottom-16 left-1/2 w-48 -translate-x-1/2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
              <Link to="/invoices/new" onClick={() => setCreateOpen(false)} className="block px-4 py-3 text-sm font-medium hover:bg-slate-50">
                New invoice
              </Link>
              <Link to="/receipts/new" onClick={() => setCreateOpen(false)} className="block border-t border-slate-100 px-4 py-3 text-sm font-medium hover:bg-slate-50">
                New receipt
              </Link>
            </div>
          )}
        </div>
        {[NAV[2]!, NAV[3]!].map((item) => (
          <BottomLink key={item.to} {...item} />
        ))}
      </nav>
    </div>
  );
}

function BottomLink({ to, label, icon }: { to: string; label: string; icon: IconName }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center gap-0.5 py-2 text-[0.7rem] font-medium ${isActive ? 'text-teal-700' : 'text-slate-500'}`
      }
    >
      <Icon name={icon} />
      {label}
    </NavLink>
  );
}
