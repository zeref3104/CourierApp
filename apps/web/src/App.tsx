import { Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from './store';
import { setTheme } from './store/slices/uiSlice';

// Layouts
import AuthLayout from './components/layout/AuthLayout';
import AdminLayout from './components/layout/AdminLayout';
import ClientLayout from './components/layout/ClientLayout';

// Pages
import LoginPage from './pages/auth/LoginPage';
import ChangePasswordPage from './pages/auth/ChangePasswordPage';
import DashboardPage from './pages/admin/DashboardPage';
import CompaniesPage from './pages/admin/companies/CompaniesPage';
import CreateCompanyPage from './pages/admin/companies/CreateCompanyPage';
import EditCompanyPage from './pages/admin/companies/EditCompanyPage';
import CustomerListPage from './pages/admin/customers/CustomerListPage';
import CustomerFormPage from './pages/admin/customers/CustomerFormPage';
import CustomerDetailPage from './pages/admin/customers/CustomerDetailPage';
import PackageListPage from './pages/admin/packages/PackageListPage';
import PackageFormPage from './pages/admin/packages/PackageFormPage';
import PackageDetailPage from './pages/admin/packages/PackageDetailPage';
import PaymentListPage from './pages/admin/payments/PaymentListPage';
import PaymentFormPage from './pages/admin/payments/PaymentFormPage';
import PaymentDetailPage from './pages/admin/payments/PaymentDetailPage';
import DeliveryListPage from './pages/admin/deliveries/DeliveryListPage';
import UserListPage from './pages/admin/users/UserListPage';
import UserFormPage from './pages/admin/users/UserFormPage';
import BranchListPage from './pages/admin/branches/BranchListPage';
import ReportsPage from './pages/admin/reports/ReportsPage';
import SettingsPage from './pages/admin/settings/SettingsPage';
import ClientDashboardPage from './pages/client/ClientDashboardPage';
import MyPackagesPage from './pages/client/MyPackagesPage';
import ClientPackageDetailPage from './pages/client/PackageDetailPage';

import ProtectedRoute from './router/ProtectedRoute';
import { useSocket } from './hooks/useSocket';

/** Internal component that activates socket.io when authenticated. */
function SocketInit() {
  useSocket();
  return null;
}

function App() {
  const dispatch = useDispatch();
  const theme = useSelector((state: RootState) => state.ui.theme);

  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'light';
    dispatch(setTheme(saved));
  }, [dispatch]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <>
      <SocketInit />
      <Routes>
      {/* Auth */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/change-password" element={<ChangePasswordPage />} />
      </Route>

      {/* Admin */}
      <Route element={<ProtectedRoute roles={['admin', 'superadmin', 'cashier', 'reception', 'warehouse', 'delivery']} />}>
        <Route element={<AdminLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/companies" element={<CompaniesPage />} />
          <Route path="/companies/new" element={<CreateCompanyPage />} />
          <Route path="/companies/:id/edit" element={<EditCompanyPage />} />
          <Route path="/customers" element={<CustomerListPage />} />
          <Route path="/customers/new" element={<CustomerFormPage />} />
          <Route path="/customers/:id" element={<CustomerDetailPage />} />
          <Route path="/customers/:id/edit" element={<CustomerFormPage />} />
          <Route path="/packages" element={<PackageListPage />} />
          <Route path="/packages/new" element={<PackageFormPage />} />
          <Route path="/packages/:id" element={<PackageDetailPage />} />
          <Route path="/payments" element={<PaymentListPage />} />
          <Route path="/payments/new" element={<PaymentFormPage />} />
          <Route path="/payments/:id" element={<PaymentDetailPage />} />
          <Route path="/deliveries" element={<DeliveryListPage />} />
          <Route path="/users" element={<UserListPage />} />
          <Route path="/users/new" element={<UserFormPage />} />
          <Route path="/users/:id/edit" element={<UserFormPage />} />
          <Route path="/branches" element={<BranchListPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      {/* Client */}
      <Route element={<ProtectedRoute roles={['client']} />}>
        <Route element={<ClientLayout />}>
          <Route path="/client" element={<ClientDashboardPage />} />
          <Route path="/client/packages" element={<MyPackagesPage />} />
          <Route path="/client/packages/:tracking" element={<ClientPackageDetailPage />} />
        </Route>
      </Route>
    </Routes>
    </>
  );
}

export default App;