import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import Clients from './pages/Clients';
import ClientProfile from './pages/ClientProfile';
import Quotations from './pages/Quotations';
import QuotationDetails from './pages/QuotationDetails';
import Contracts from './pages/Contracts';
import Collections from './pages/Collections';
import Expenses from './pages/Expenses';
import Revenue from './pages/Revenue';
import SpareParts from './pages/SpareParts';
import SparePartsInvoice from './pages/SparePartsInvoice';
import SparePartsInvoiceDetails from './pages/SparePartsInvoiceDetails';
import Employees from './pages/Employees';
import EmployeeProfile from './pages/EmployeeProfile';
import Payroll from './pages/Payroll';
import Users from './pages/Users';
import Notifications from './pages/Notifications';
import ActivityLog from './pages/ActivityLog';
import Integrations from './pages/Integrations';
import Services from './pages/Services';
import PublicQuotation from './pages/PublicQuotation';

function AppRoutes() {
  const { user, loading } = useAuth();
  const [cityFilter, setCityFilter] = useState('all');

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/q/:id" element={<PublicQuotation />} />
      
      <Route path="/*" element={
        <ProtectedRoute>
          <Layout cityFilter={cityFilter} setCityFilter={setCityFilter}>
            <Routes>
              <Route path="/" element={<ProtectedRoute permission="dashboard.view"><Dashboard cityFilter={cityFilter} /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute permission="analytics.view"><Analytics cityFilter={cityFilter} /></ProtectedRoute>} />
              <Route path="/clients" element={<ProtectedRoute permission="clients.view"><Clients cityFilter={cityFilter} /></ProtectedRoute>} />
              <Route path="/clients/:id" element={<ProtectedRoute permission="clients.view"><ClientProfile /></ProtectedRoute>} />
              <Route path="/quotations" element={<ProtectedRoute permission="quotations.view"><Quotations cityFilter={cityFilter} /></ProtectedRoute>} />
              <Route path="/quotations/:id" element={<ProtectedRoute permission="quotations.view"><QuotationDetails /></ProtectedRoute>} />
              <Route path="/contracts" element={<ProtectedRoute permission="contracts.view"><Contracts cityFilter={cityFilter} /></ProtectedRoute>} />
              <Route path="/collections" element={<ProtectedRoute permission="collections.view"><Collections cityFilter={cityFilter} /></ProtectedRoute>} />
              <Route path="/expenses" element={<ProtectedRoute permission="expenses.view"><Expenses cityFilter={cityFilter} /></ProtectedRoute>} />
              <Route path="/revenue" element={<ProtectedRoute permission="revenue.view"><Revenue cityFilter={cityFilter} /></ProtectedRoute>} />
              <Route path="/spare-parts" element={<ProtectedRoute permission="spare_parts.view"><SpareParts cityFilter={cityFilter} /></ProtectedRoute>} />
              <Route path="/spare-parts/invoice" element={<ProtectedRoute permission="spare_parts.view"><SparePartsInvoice /></ProtectedRoute>} />
              <Route path="/spare-parts/invoices/:id" element={<ProtectedRoute permission="spare_parts.view"><SparePartsInvoiceDetails /></ProtectedRoute>} />
              <Route path="/payroll" element={<ProtectedRoute permission="payroll.view"><Payroll cityFilter={cityFilter} /></ProtectedRoute>} />
              <Route path="/employees" element={<ProtectedRoute permission="employees.view"><Employees cityFilter={cityFilter} /></ProtectedRoute>} />
              <Route path="/employees/:id" element={<ProtectedRoute permission="employees.view"><EmployeeProfile /></ProtectedRoute>} />
              <Route path="/services" element={<ProtectedRoute permission="services.view"><Services /></ProtectedRoute>} />
              <Route path="/users" element={
                <ProtectedRoute adminOnly>
                  <Users />
                </ProtectedRoute>
              } />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/activity-log" element={<ProtectedRoute permission="activity_log.view"><ActivityLog cityFilter={cityFilter} /></ProtectedRoute>} />
              <Route path="/integrations" element={
                <ProtectedRoute adminOnly>
                  <Integrations />
                </ProtectedRoute>
              } />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </ProtectedRoute>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}
