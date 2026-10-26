import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Alert, LoaderPage } from './components/ui';
import { errorMessage } from './lib/api';
import { useMe } from './lib/session';
import { AdminPage } from './pages/AdminPage';
import { LoginPage, ResetPasswordPage, SignupPage } from './pages/AuthPages';
import { BillingPage, BillingReturnPage } from './pages/BillingPage';
import { CustomersPage } from './pages/CustomersPage';
import { DashboardPage } from './pages/DashboardPage';
import { InvoiceEditorPage } from './pages/InvoiceEditorPage';
import { InvoiceListPage } from './pages/InvoiceListPage';
import { InvoiceViewPage } from './pages/InvoiceViewPage';
import { LandingPage } from './pages/LandingPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { ProductsPage } from './pages/ProductsPage';
import { PublicDocumentPage } from './pages/PublicDocumentPage';
import { ReceiptEditorPage } from './pages/ReceiptEditorPage';
import { ReceiptListPage } from './pages/ReceiptListPage';
import { ReceiptViewPage } from './pages/ReceiptViewPage';
import { SettingsPage } from './pages/SettingsPage';

function Gate({ need, children }: { need: 'guest' | 'user' | 'business'; children: ReactNode }) {
  const { data: me, isLoading, error } = useMe();
  const location = useLocation();
  if (isLoading) return <LoaderPage />;
  if (error) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Alert tone="error">{errorMessage(error)}</Alert>
      </div>
    );
  }

  if (need === 'guest') {
    if (me?.business) return <Navigate to="/dashboard" replace />;
    if (me) return <Navigate to="/onboarding" replace />;
    return children;
  }
  if (!me) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  // Onboarding continues (logo, template) after the business exists, so it only needs a login.
  if (need === 'user') return children;
  if (!me.business) return <Navigate to="/onboarding" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Gate need="guest"><LandingPage /></Gate>} />
        <Route path="/login" element={<Gate need="guest"><LoginPage /></Gate>} />
        <Route path="/signup" element={<Gate need="guest"><SignupPage /></Gate>} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/d/:token" element={<PublicDocumentPage />} />
        <Route path="/onboarding" element={<Gate need="user"><OnboardingPage /></Gate>} />

        <Route element={<Gate need="business"><AppShell /></Gate>}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/invoices" element={<InvoiceListPage />} />
          <Route path="/invoices/new" element={<InvoiceEditorPage />} />
          <Route path="/invoices/:id" element={<InvoiceViewPage />} />
          <Route path="/invoices/:id/edit" element={<InvoiceEditorPage />} />
          <Route path="/receipts" element={<ReceiptListPage />} />
          <Route path="/receipts/new" element={<ReceiptEditorPage />} />
          <Route path="/receipts/:id" element={<ReceiptViewPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/billing/return" element={<BillingReturnPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
