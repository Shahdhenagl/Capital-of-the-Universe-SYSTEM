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
import Employees from './pages/Employees';
import EmployeeProfile from './pages/EmployeeProfile';
import Users from './pages/Users';
import Notifications from './pages/Notifications';
import ActivityLog from './pages/ActivityLog';

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
      
      <Route path="/*" element={
        <ProtectedRoute>
          <Layout cityFilter={cityFilter} setCityFilter={setCityFilter}>
            <Routes>
              <Route path="/" element={<Dashboard cityFilter={cityFilter} />} />
              <Route path="/analytics" element={<Analytics cityFilter={cityFilter} />} />
              <Route path="/clients" element={<Clients cityFilter={cityFilter} />} />
              <Route path="/clients/:id" element={<ClientProfile />} />
              <Route path="/quotations" element={<Quotations cityFilter={cityFilter} />} />
              <Route path="/quotations/:id" element={<QuotationDetails />} />
              <Route path="/contracts" element={<Contracts cityFilter={cityFilter} />} />
              <Route path="/collections" element={<Collections cityFilter={cityFilter} />} />
              <Route path="/expenses" element={<Expenses cityFilter={cityFilter} />} />
              <Route path="/revenue" element={<Revenue cityFilter={cityFilter} />} />
              <Route path="/spare-parts" element={<SpareParts cityFilter={cityFilter} />} />
              <Route path="/spare-parts/invoice" element={<SparePartsInvoice />} />
              <Route path="/employees" element={<Employees cityFilter={cityFilter} />} />
              <Route path="/employees/:id" element={<EmployeeProfile />} />
              <Route path="/users" element={
                <ProtectedRoute adminOnly>
                  <Users />
                </ProtectedRoute>
              } />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/activity-log" element={<ActivityLog cityFilter={cityFilter} />} />
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
