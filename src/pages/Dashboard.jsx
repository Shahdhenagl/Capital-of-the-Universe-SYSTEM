import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, formatCurrency, formatDate, CITIES } from '../lib/supabase';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, Users,
  FileText, AlertCircle, Wallet, Calendar,
  ArrowLeft, Clock, Building2
} from 'lucide-react';

const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899'];

function Dashboard({ cityFilter }) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    cashBalance: 0,
    totalClients: 0,
    pendingCollections: 0
  });
  const [monthlyData, setMonthlyData] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [upcomingCollections, setUpcomingCollections] = useState([]);
  const [overdueClients, setOverdueClients] = useState([]);
  const [pendingQuotations, setPendingQuotations] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, [cityFilter]);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      await Promise.all([
        fetchStats(),
        fetchMonthlyData(),
        fetchRecentTransactions(),
        fetchUpcomingCollections(),
        fetchOverdueClients(),
        (profile?.role === 'sales_manager' || profile?.role === 'admin') ? fetchPendingQuotations() : Promise.resolve()
      ]);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchStats() {
    // Fetch total revenue
    let revenueQuery = supabase.from('revenues').select('amount');
    if (cityFilter && cityFilter !== 'all') {
      revenueQuery = revenueQuery.eq('branch', cityFilter);
    }
    const { data: revenues } = await revenueQuery;
    const totalRevenue = revenues?.reduce((sum, r) => sum + Number(r.amount || 0), 0) || 0;

    // Fetch total expenses
    let expenseQuery = supabase.from('expenses').select('amount');
    if (cityFilter && cityFilter !== 'all') {
      expenseQuery = expenseQuery.eq('branch', cityFilter);
    }
    const { data: expenses } = await expenseQuery;
    const totalExpenses = expenses?.reduce((sum, e) => sum + Number(e.amount || 0), 0) || 0;

    // Fetch total clients
    let clientQuery = supabase.from('clients').select('id', { count: 'exact', head: true }).neq('status', 'inactive');
    if (cityFilter && cityFilter !== 'all') {
      clientQuery = clientQuery.eq('city', cityFilter);
    }
    const { count: totalClients } = await clientQuery;

    // Fetch pending collections
    let collectionQuery = supabase
      .from('collection_schedule')
      .select('amount')
      .eq('status', 'pending');
    if (cityFilter && cityFilter !== 'all') {
      collectionQuery = collectionQuery.eq('branch', cityFilter);
    }
    const { data: pendingCols } = await collectionQuery;
    const pendingCollections = pendingCols?.reduce((sum, c) => sum + Number(c.amount || 0), 0) || 0;

    // Fetch cash balance
    let cashQuery = supabase
      .from('cash_register')
      .select('closing_balance')
      .order('date', { ascending: false })
      .limit(1);
    if (cityFilter && cityFilter !== 'all') {
      cashQuery = cashQuery.eq('branch', cityFilter);
    }
    const { data: cashData } = await cashQuery;
    const cashBalance = cashData?.[0]?.closing_balance || 0;

    setStats({
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      cashBalance: Number(cashBalance),
      totalClients: totalClients || 0,
      pendingCollections
    });
  }

  async function fetchMonthlyData() {
    const currentYear = new Date().getFullYear();
    const startDate = `${currentYear}-01-01`;
    const endDate = `${currentYear}-12-31`;

    // Fetch revenues for current year
    let revQuery = supabase
      .from('revenues')
      .select('amount, revenue_date')
      .gte('revenue_date', startDate)
      .lte('revenue_date', endDate);
    if (cityFilter && cityFilter !== 'all') {
      revQuery = revQuery.eq('branch', cityFilter);
    }
    const { data: revData } = await revQuery;

    // Fetch expenses for current year
    let expQuery = supabase
      .from('expenses')
      .select('amount, expense_date')
      .gte('expense_date', startDate)
      .lte('expense_date', endDate);
    if (cityFilter && cityFilter !== 'all') {
      expQuery = expQuery.eq('branch', cityFilter);
    }
    const { data: expData } = await expQuery;

    // Group by month
    const monthly = MONTHS_AR.map((name, index) => {
      const monthRevenues = (revData || [])
        .filter(r => new Date(r.revenue_date).getMonth() === index)
        .reduce((sum, r) => sum + Number(r.amount || 0), 0);

      const monthExpenses = (expData || [])
        .filter(e => new Date(e.expense_date).getMonth() === index)
        .reduce((sum, e) => sum + Number(e.amount || 0), 0);

      return {
        name,
        الإيرادات: monthRevenues,
        المصروفات: monthExpenses
      };
    });

    setMonthlyData(monthly);
  }

  async function fetchRecentTransactions() {
    // Fetch recent revenues
    let revQuery = supabase
      .from('revenues')
      .select('id, amount, revenue_date, description, category_id, created_by_name, revenue_categories(name)')
      .order('created_at', { ascending: false })
      .limit(5);
    if (cityFilter && cityFilter !== 'all') {
      revQuery = revQuery.eq('branch', cityFilter);
    }
    const { data: revenues } = await revQuery;

    // Fetch recent expenses
    let expQuery = supabase
      .from('expenses')
      .select('id, amount, expense_date, description, category_id, created_by_name, expense_categories(name)')
      .order('created_at', { ascending: false })
      .limit(5);
    if (cityFilter && cityFilter !== 'all') {
      expQuery = expQuery.eq('branch', cityFilter);
    }
    const { data: expenses } = await expQuery;

    const allTransactions = [
      ...(revenues || []).map(r => ({
        id: r.id,
        type: 'revenue',
        amount: r.amount,
        date: r.revenue_date,
        description: r.description || r.revenue_categories?.name || 'إيراد',
        category: r.revenue_categories?.name || '',
        userName: r.created_by_name || ''
      })),
      ...(expenses || []).map(e => ({
        id: e.id,
        type: 'expense',
        amount: e.amount,
        date: e.expense_date,
        description: e.description || e.expense_categories?.name || 'مصروف',
        category: e.expense_categories?.name || '',
        userName: e.created_by_name || ''
      }))
    ];

    allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    setRecentTransactions(allTransactions.slice(0, 5));
  }

  async function fetchUpcomingCollections() {
    const today = new Date().toISOString().split('T')[0];
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const weekEnd = weekFromNow.toISOString().split('T')[0];

    let query = supabase
      .from('collection_schedule')
      .select('id, due_date, amount, status, client_id, clients(name)')
      .gte('due_date', today)
      .lte('due_date', weekEnd)
      .eq('status', 'pending')
      .order('due_date', { ascending: true })
      .limit(10);
    if (cityFilter && cityFilter !== 'all') {
      query = query.eq('branch', cityFilter);
    }
    const { data } = await query;
    setUpcomingCollections(data || []);
  }

  async function fetchOverdueClients() {
    const today = new Date().toISOString().split('T')[0];

    let query = supabase
      .from('collection_schedule')
      .select('id, due_date, amount, client_id, clients(name, phone)')
      .lt('due_date', today)
      .in('status', ['pending', 'overdue'])
      .order('due_date', { ascending: true })
      .limit(10);
    if (cityFilter && cityFilter !== 'all') {
      query = query.eq('branch', cityFilter);
    }
    const { data } = await query;
    setOverdueClients(data || []);
  }

  async function fetchPendingQuotations() {
    let query = supabase
      .from('quotations')
      .select('id, title, amount, created_at, clients(name)')
      .eq('status', 'pending_manager')
      .order('created_at', { ascending: false })
      .limit(5);
    if (cityFilter && cityFilter !== 'all') {
      query = query.eq('branch', cityFilter);
    }
    const { data } = await query;
    setPendingQuotations(data || []);
  }

  const statCards = [
    {
      label: 'إجمالي الإيرادات',
      value: formatCurrency(stats.totalRevenue),
      color: 'success',
      icon: <TrendingUp size={24} />
    },
    {
      label: 'إجمالي المصروفات',
      value: formatCurrency(stats.totalExpenses),
      color: 'danger',
      icon: <TrendingDown size={24} />
    },
    {
      label: 'صافي الربح',
      value: formatCurrency(stats.netProfit),
      color: 'primary',
      icon: <DollarSign size={24} />
    },
    {
      label: 'رصيد الخزنة',
      value: formatCurrency(stats.cashBalance),
      color: 'info',
      icon: <Wallet size={24} />
    },
    {
      label: 'عدد العملاء',
      value: stats.totalClients.toLocaleString('ar-SA'),
      color: 'warning',
      icon: <Users size={24} />
    },
    {
      label: 'تحصيلات معلقة',
      value: formatCurrency(stats.pendingCollections),
      color: 'danger',
      icon: <AlertCircle size={24} />
    }
  ];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="card" style={{ padding: '12px 16px', minWidth: '160px' }}>
          <p className="font-bold mb-16" style={{ marginBottom: '8px' }}>{label}</p>
          {payload.map((item, index) => (
            <p key={index} style={{ color: item.color, fontSize: '0.85rem', marginBottom: '4px' }}>
              {item.name}: {formatCurrency(item.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="loading-inline">
        <div className="loader"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">
          <span className="title-icon" style={{ background: 'var(--primary-bg)', color: 'var(--primary-light)' }}>
            <Building2 size={28} />
          </span>
          لوحة التحكم
        </h1>
        <div className="page-actions">
          <span className="badge badge-info">
            <Calendar size={14} />
            {formatDate(new Date())}
          </span>
          {cityFilter && cityFilter !== 'all' && (
            <span className="badge badge-primary">
              {CITIES[cityFilter] || cityFilter}
            </span>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        {statCards.map((card, index) => (
          <div key={index} className={`stat-card ${card.color}`}>
            <div className="stat-info">
              <div className="stat-label">{card.label}</div>
              <div className="stat-value">{card.value}</div>
            </div>
            <div className={`stat-icon ${card.color}`}>
              {card.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Charts and Recent Activity */}
      <div className="grid-2 mb-24">
        {/* Revenue vs Expenses Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <TrendingUp size={18} />
              الإيرادات والمصروفات الشهرية
            </h3>
          </div>
          <div className="card-body">
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.5)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    axisLine={{ stroke: '#334155' }}
                  />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    axisLine={{ stroke: '#334155' }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="الإيرادات" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="المصروفات" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <FileText size={18} />
              أحدث المعاملات
            </h3>
          </div>
          <div className="card-body">
            {recentTransactions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3>لا توجد معاملات</h3>
                <p>لم يتم تسجيل أي معاملات بعد</p>
              </div>
            ) : (
              <div>
                {recentTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex-between"
                    style={{
                      padding: '14px 0',
                      borderBottom: '1px solid var(--border)'
                    }}
                  >
                    <div className="flex gap-12" style={{ alignItems: 'center' }}>
                      <div
                        className={`stat-icon ${transaction.type === 'revenue' ? 'success' : 'danger'}`}
                        style={{ width: '40px', height: '40px', fontSize: '1rem', borderRadius: '10px' }}
                      >
                        {transaction.type === 'revenue' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                      </div>
                      <div>
                        <div className="font-semibold" style={{ fontSize: '0.9rem' }}>
                          {transaction.description}
                        </div>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                          {formatDate(transaction.date)}
                          {transaction.userName ? ` - بواسطة ${transaction.userName}` : ''}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`font-bold ${transaction.type === 'revenue' ? 'text-success' : 'text-danger'}`}
                      style={{ fontSize: '0.95rem' }}
                    >
                      {transaction.type === 'revenue' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming Collections and Overdue */}
      <div className="grid-2">
        {/* Upcoming Collections */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Clock size={18} />
              تحصيلات قادمة (هذا الأسبوع)
            </h3>
            <span className="badge badge-info">{upcomingCollections.length}</span>
          </div>
          <div className="card-body">
            {upcomingCollections.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✅</div>
                <h3>لا توجد تحصيلات قادمة</h3>
                <p>لا توجد تحصيلات مستحقة خلال هذا الأسبوع</p>
              </div>
            ) : (
              <div>
                {upcomingCollections.map((col) => (
                  <div
                    key={col.id}
                    className="flex-between"
                    style={{
                      padding: '12px 0',
                      borderBottom: '1px solid var(--border)'
                    }}
                  >
                    <div>
                      <div className="font-semibold" style={{ fontSize: '0.9rem' }}>
                        {col.clients?.name || 'عميل'}
                      </div>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                        <Calendar size={12} style={{ display: 'inline', marginLeft: '4px' }} />
                        {formatDate(col.due_date)}
                      </div>
                    </div>
                    <div className="font-bold text-info">
                      {formatCurrency(col.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Overdue Clients */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <AlertCircle size={18} className="text-danger" />
              عملاء متأخرون في السداد
            </h3>
            <span className="badge badge-danger">{overdueClients.length}</span>
          </div>
          <div className="card-body">
            {overdueClients.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🎉</div>
                <h3>لا توجد متأخرات</h3>
                <p>جميع العملاء ملتزمون بالسداد</p>
              </div>
            ) : (
              <div>
                {overdueClients.map((client) => {
                  const daysOverdue = Math.floor(
                    (new Date() - new Date(client.due_date)) / (1000 * 60 * 60 * 24)
                  );
                  return (
                    <div
                      key={client.id}
                      className="flex-between"
                      style={{
                        padding: '12px 16px',
                        marginBottom: '8px',
                        background: 'var(--danger-bg)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid rgba(239, 68, 68, 0.2)'
                      }}
                    >
                      <div>
                        <div className="font-semibold" style={{ fontSize: '0.9rem' }}>
                          {client.clients?.name || 'عميل'}
                        </div>
                        <div className="text-danger" style={{ fontSize: '0.75rem' }}>
                          متأخر {daysOverdue} يوم — مستحق: {formatDate(client.due_date)}
                        </div>
                      </div>
                      <div className="font-bold text-danger">
                        {formatCurrency(client.amount)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pending Manager Approvals (Sales Managers & Admins only) */}
      {(profile?.role === 'sales_manager' || profile?.role === 'admin') && pendingQuotations.length > 0 && (
        <div className="card mt-24">
          <div className="card-header">
            <h3 className="card-title">
              <FileText size={18} className="text-warning" />
              عروض أسعار بانتظار الاعتماد
            </h3>
            <span className="badge badge-warning">{pendingQuotations.length}</span>
          </div>
          <div className="card-body">
            <div>
              {pendingQuotations.map((quote) => (
                <div
                  key={quote.id}
                  className="flex-between"
                  style={{
                    padding: '12px 16px',
                    marginBottom: '8px',
                    background: 'var(--warning-bg)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(245, 158, 11, 0.2)'
                  }}
                >
                  <div>
                    <div className="font-semibold" style={{ fontSize: '0.9rem' }}>
                      {quote.title || 'عرض سعر'} - {quote.clients?.name || 'عميل'}
                    </div>
                    <div className="text-warning" style={{ fontSize: '0.75rem' }}>
                      تم الإنشاء: {formatDate(quote.created_at)}
                    </div>
                  </div>
                  <div className="font-bold text-warning">
                    {formatCurrency(quote.amount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
