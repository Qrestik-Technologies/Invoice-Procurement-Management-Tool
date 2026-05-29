import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import InvoicesPage from './pages/InvoicesPage';
import MilestonesPage from './pages/MilestonesPage';
import CustomersPage from './pages/CustomersPage';
import RemindersPage from './pages/RemindersPage';
import DocumentsPage from './pages/DocumentsPage';
import CashFlowPage from './pages/CashFlowPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="invoices" element={<InvoicesPage />} />
          <Route path="milestones" element={<MilestonesPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="reminders" element={<RemindersPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="cash-flow" element={<CashFlowPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
