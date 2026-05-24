import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, formatCurrency, formatDate, CITIES } from '../lib/supabase';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  BarChart3, PieChart as PieChartIcon, TrendingUp, TrendingDown,
  DollarSign, AlertTriangle, Users, Building2, Calendar,
  Filter, Package, FileX
} from 'lucide-react';

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899'];

const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

const PERIODS = [
  { key: 'daily', label: 'يومي' },
  { key: 'monthly', label: 'شهري' },
  { key: 'yearly', label: 'سنوي' }
];

function Analytics({ cityFilter: propCityFilter }) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('monthly');
  const [cityFilter, setCityFilter] = useState(propCityFilter || 'all');

  // Stats
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    cashBalance: 0,
    sparePartsProfit: 0
  });

  // Chart Data
  const [revenueExpenseData, setRevenueExpenseData] = useState([]);
  const [revenueByCategoryData, setRevenueByCategoryData] = useState([]);
  const [expenseByCategoryData, setExpenseByCategoryData] = useState([]);
  const [collectionsData, setCollectionsData] = useState([]);
  const [topClients, setTopClients] = useState([]);
  const [branchData, setBranchData] = useState([]);
  const [rejectedQuotations, setRejectedQuotations] = useState([]);

  useEffect(() => {
    setCityFilter(propCityFilter || 'all');
  }, [propCityFilter]);

  useEffect(() => {
    fetchAllData();
  }, [period, cityFilter]);

  async function fetchAllData() {
    setLoading(true);
    try {
      await Promise.all([
        fetchStats(),
        fetchRevenueExpenseOverTime(),
        fetchRevenueByCategory(),
        fetchExpenseByCategory(),
        fetchCollectionsAnalysis(),
        fetchTopClients(),
        fetchBranchComparison(),
        fetchRejectedQuotations()
      ]);
    } catch (err) {
      console.error('Error fetching analytics data:', err);
    } finally {
      setLoading(false);
    }
  }

  function getDateRange() {
    const now = new Date();
    let start, end;

    if (period === 'daily') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (period === 'monthly') {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31);
    } else {
      start = new Date(now.getFullYear() - 4, 0, 1);
      end = new Date(now.getFullYear(), 11, 31);
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  }

  async function fetchStats() {
    const { start, end } = getDateRange();

    // Total Revenue
    let revQuery = supabase.from('revenues').select('amount')
      .gte('revenue_date', start).lte('revenue_date', end);
    if (cityFilter !== 'all') revQuery = revQuery.eq('branch', cityFilter);
    const { data: revenues } = await revQuery;
    const totalRevenue = (revenues || []).reduce((sum, r) => sum + Number(r.amount || 0), 0);

    // Total Expenses
    let expQuery = supabase.from('expenses').select('amount')
      .gte('expense_date', start).lte('expense_date', end);
    if (cityFilter !== 'all') expQuery = expQuery.eq('branch', cityFilter);
    const { data: expenses } = await expQuery;
    const totalExpenses = (expenses || []).reduce((sum, e) => sum + Number(e.amount || 0), 0);

    // Cash Balance
    let cashQuery = supabase.from('cash_register')
      .select('closing_balance')
      .order('date', { ascending: false })
      .limit(1);
    if (cityFilter !== 'all') cashQuery = cashQuery.eq('branch', cityFilter);
    const { data: cashData } = await cashQuery;

    // Spare Parts Profit
    let spQuery = supabase.from('spare_parts_invoices').select('total_profit');
    if (cityFilter !== 'all') spQuery = spQuery.eq('branch', cityFilter);
    const { data: spData } = await spQuery;
    const sparePartsProfit = (spData || []).reduce((sum, s) => sum + Number(s.total_profit || 0), 0);

    setStats({
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      cashBalance: Number(cashData?.[0]?.closing_balance || 0),
      sparePartsProfit
    });
  }

  async function fetchRevenueExpenseOverTime() {
    const { start, end } = getDateRange();

    let revQuery = supabase.from('revenues').select('amount, revenue_date')
      .gte('revenue_date', start).lte('revenue_date', end);
    if (cityFilter !== 'all') revQuery = revQuery.eq('branch', cityFilter);
    const { data: revData } = await revQuery;

    let expQuery = supabase.from('expenses').select('amount, expense_date')
      .gte('expense_date', start).lte('expense_date', end);
    if (cityFilter !== 'all') expQuery = expQuery.eq('branch', cityFilter);
    const { data: expData } = await expQuery;

    let chartData = [];

    if (period === 'daily') {
      const now = new Date();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

      for (let d = 1; d <= daysInMonth; d++) {
        const dayStr = String(d);
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

        const dayRev = (revData || [])
          .filter(r => r.revenue_date === dateStr)
          .reduce((sum, r) => sum + Number(r.amount || 0), 0);

        const dayExp = (expData || [])
          .filter(e => e.expense_date === dateStr)
          .reduce((sum, e) => sum + Number(e.amount || 0), 0);

        chartData.push({ name: dayStr, الإيرادات: dayRev, المصروفات: dayExp });
      }
    } else if (period === 'monthly') {
      chartData = MONTHS_AR.map((name, index) => {
        const monthRev = (revData || [])
          .filter(r => new Date(r.revenue_date).getMonth() === index)
          .reduce((sum, r) => sum + Number(r.amount || 0), 0);

        const monthExp = (expData || [])
          .filter(e => new Date(e.expense_date).getMonth() === index)
          .reduce((sum, e) => sum + Number(e.amount || 0), 0);

        return { name, الإيرادات: monthRev, المصروفات: monthExp };
      });
    } else {
      const currentYear = new Date().getFullYear();
      for (let y = currentYear - 4; y <= currentYear; y++) {
        const yearRev = (revData || [])
          .filter(r => new Date(r.revenue_date).getFullYear() === y)
          .reduce((sum, r) => sum + Number(r.amount || 0), 0);

        const yearExp = (expData || [])
          .filter(e => new Date(e.expense_date).getFullYear() === y)
          .reduce((sum, e) => sum + Number(e.amount || 0), 0);

        chartData.push({ name: String(y), الإيرادات: yearRev, المصروفات: yearExp });
      }
    }

    setRevenueExpenseData(chartData);
  }

  async function fetchRevenueByCategory() {
    const { start, end } = getDateRange();

    let query = supabase.from('revenues')
      .select('amount, revenue_categories(name)')
      .gte('revenue_date', start).lte('revenue_date', end);
    if (cityFilter !== 'all') query = query.eq('branch', cityFilter);
    const { data } = await query;

    const categoryMap = {};
    (data || []).forEach(r => {
      const catName = r.revenue_categories?.name || 'أخرى';
      categoryMap[catName] = (categoryMap[catName] || 0) + Number(r.amount || 0);
    });

    const chartData = Object.entries(categoryMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    setRevenueByCategoryData(chartData);
  }

  async function fetchExpenseByCategory() {
    const { start, end } = getDateRange();

    let query = supabase.from('expenses')
      .select('amount, expense_categories(name)')
      .gte('expense_date', start).lte('expense_date', end);
    if (cityFilter !== 'all') query = query.eq('branch', cityFilter);
    const { data } = await query;

    const categoryMap = {};
    (data || []).forEach(e => {
      const catName = e.expense_categories?.name || 'أخرى';
      categoryMap[catName] = (categoryMap[catName] || 0) + Number(e.amount || 0);
    });

    const chartData = Object.entries(categoryMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    setExpenseByCategoryData(chartData);
  }

  async function fetchCollectionsAnalysis() {
    let query = supabase.from('collection_schedule')
      .select('amount, status');
    if (cityFilter !== 'all') query = query.eq('branch', cityFilter);
    const { data } = await query;

    const collected = (data || [])
      .filter(c => c.status === 'collected')
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const pending = (data || [])
      .filter(c => c.status === 'pending')
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const overdue = (data || [])
      .filter(c => c.status === 'overdue')
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const partial = (data || [])
      .filter(c => c.status === 'partial')
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    setCollectionsData([
      { name: 'محصّل', value: collected },
      { name: 'معلّق', value: pending },
      { name: 'متأخر', value: overdue },
      { name: 'جزئي', value: partial }
    ].filter(d => d.value > 0));
  }

  async function fetchTopClients() {
    let query = supabase.from('revenues')
      .select('amount, client_id, clients(name)');
    if (cityFilter !== 'all') query = query.eq('branch', cityFilter);
    const { data } = await query;

    const clientMap = {};
    (data || []).forEach(r => {
      if (r.client_id && r.clients?.name) {
        clientMap[r.client_id] = {
          name: r.clients.name,
          total: (clientMap[r.client_id]?.total || 0) + Number(r.amount || 0)
        };
      }
    });

    const sorted = Object.values(clientMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    setTopClients(sorted);
  }

  async function fetchBranchComparison() {
    // Mecca revenues
    const { data: meccaRev } = await supabase
      .from('revenues').select('amount').eq('branch', 'mecca');
    const meccaRevTotal = (meccaRev || []).reduce((sum, r) => sum + Number(r.amount || 0), 0);

    // Mecca expenses
    const { data: meccaExp } = await supabase
      .from('expenses').select('amount').eq('branch', 'mecca');
    const meccaExpTotal = (meccaExp || []).reduce((sum, e) => sum + Number(e.amount || 0), 0);

    // Jeddah revenues
    const { data: jeddahRev } = await supabase
      .from('revenues').select('amount').eq('branch', 'jeddah');
    const jeddahRevTotal = (jeddahRev || []).reduce((sum, r) => sum + Number(r.amount || 0), 0);

    // Jeddah expenses
    const { data: jeddahExp } = await supabase
      .from('expenses').select('amount').eq('branch', 'jeddah');
    const jeddahExpTotal = (jeddahExp || []).reduce((sum, e) => sum + Number(e.amount || 0), 0);

    setBranchData([
      {
        name: 'مكة المكرمة',
        الإيرادات: meccaRevTotal,
        المصروفات: meccaExpTotal,
        الربح: meccaRevTotal - meccaExpTotal
      },
      {
        name: 'جدة',
        الإيرادات: jeddahRevTotal,
        المصروفات: jeddahExpTotal,
        الربح: jeddahRevTotal - jeddahExpTotal
      }
    ]);
  }

  async function fetchRejectedQuotations() {
    let query = supabase
      .from('quotations')
      .select('id, title, amount, created_at, rejection_reason, clients(name)')
      .eq('status', 'rejected')
      .order('created_at', { ascending: false })
      .limit(10);
    if (cityFilter !== 'all') query = query.eq('branch', cityFilter);
    const { data } = await query;
    setRejectedQuotations(data || []);
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
      icon: <DollarSign size={24} />
    },
    {
      label: 'ربح قطع الغيار',
      value: formatCurrency(stats.sparePartsProfit),
      color: 'warning',
      icon: <Package size={24} />
    }
  ];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="card" style={{ padding: '12px 16px', minWidth: '160px' }}>
          <p className="font-bold" style={{ marginBottom: '8px' }}>{label}</p>
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

  const PieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="card" style={{ padding: '12px 16px' }}>
          <p className="font-bold" style={{ marginBottom: '4px' }}>{payload[0].name}</p>
          <p style={{ color: payload[0].payload.fill, fontSize: '0.85rem' }}>
            {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  const renderCustomLabel = ({ name, percent }) => {
    if (percent < 0.05) return null;
    return `${name} (${(percent * 100).toFixed(0)}%)`;
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
            <BarChart3 size={28} />
          </span>
          التحليلات والتقارير
        </h1>
        <div className="page-actions">
          <div className="filter-group">
            <Filter size={16} className="text-muted" />
            <select
              className="form-select"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              style={{ minWidth: '140px', padding: '8px 12px' }}
            >
              <option value="all">جميع الفروع</option>
              <option value="mecca">مكة المكرمة</option>
              <option value="jeddah">جدة</option>
            </select>
          </div>
        </div>
      </div>

      {/* Period Tabs */}
      <div className="tabs">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            className={`tab ${period === p.key ? 'active' : ''}`}
            onClick={() => setPeriod(p.key)}
          >
            {p.label}
          </button>
        ))}
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

      {/* Revenue vs Expenses Over Time */}
      <div className="card mb-24">
        <div className="card-header">
          <h3 className="card-title">
            <TrendingUp size={18} />
            الإيرادات مقابل المصروفات ({PERIODS.find(p => p.key === period)?.label})
          </h3>
        </div>
        <div className="card-body">
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueExpenseData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.5)" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={{ stroke: '#334155' }}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: '16px' }}
                  formatter={(value) => <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{value}</span>}
                />
                <Bar dataKey="الإيرادات" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="المصروفات" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Pie Charts: Revenue & Expense by Category */}
      <div className="grid-2 mb-24">
        {/* Revenue by Category */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <PieChartIcon size={18} />
              الإيرادات حسب الفئة
            </h3>
          </div>
          <div className="card-body">
            {revenueByCategoryData.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📊</div>
                <h3>لا توجد بيانات</h3>
              </div>
            ) : (
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={revenueByCategoryData}
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      innerRadius={60}
                      dataKey="value"
                      label={renderCustomLabel}
                      labelLine={{ stroke: '#94a3b8' }}
                    >
                      {revenueByCategoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Expense by Category */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <PieChartIcon size={18} />
              المصروفات حسب الفئة
            </h3>
          </div>
          <div className="card-body">
            {expenseByCategoryData.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📊</div>
                <h3>لا توجد بيانات</h3>
              </div>
            ) : (
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseByCategoryData}
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      innerRadius={60}
                      dataKey="value"
                      label={renderCustomLabel}
                      labelLine={{ stroke: '#94a3b8' }}
                    >
                      {expenseByCategoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Collections Analysis & Top Clients */}
      <div className="grid-2 mb-24">
        {/* Collections Analysis */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <DollarSign size={18} />
              تحليل التحصيلات
            </h3>
          </div>
          <div className="card-body">
            {collectionsData.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">💰</div>
                <h3>لا توجد بيانات تحصيلات</h3>
              </div>
            ) : (
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={collectionsData}
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      innerRadius={60}
                      dataKey="value"
                      label={renderCustomLabel}
                      labelLine={{ stroke: '#94a3b8' }}
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#f59e0b" />
                      <Cell fill="#ef4444" />
                      <Cell fill="#06b6d4" />
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                    <Legend
                      formatter={(value) => <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Top 5 Clients */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Users size={18} />
              أفضل 5 عملاء (حسب الإيرادات)
            </h3>
          </div>
          <div className="card-body">
            {topClients.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">👥</div>
                <h3>لا توجد بيانات عملاء</h3>
              </div>
            ) : (
              <div>
                {topClients.map((client, index) => {
                  const maxTotal = topClients[0]?.total || 1;
                  const percentage = (client.total / maxTotal) * 100;

                  return (
                    <div key={index} style={{ marginBottom: '16px' }}>
                      <div className="flex-between" style={{ marginBottom: '6px' }}>
                        <div className="flex gap-8" style={{ alignItems: 'center' }}>
                          <span
                            className="badge badge-primary"
                            style={{ minWidth: '28px', justifyContent: 'center' }}
                          >
                            {index + 1}
                          </span>
                          <span className="font-semibold" style={{ fontSize: '0.9rem' }}>
                            {client.name}
                          </span>
                        </div>
                        <span className="font-bold text-success" style={{ fontSize: '0.85rem' }}>
                          {formatCurrency(client.total)}
                        </span>
                      </div>
                      <div style={{
                        height: '8px',
                        background: 'var(--bg-tertiary)',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${percentage}%`,
                          background: `linear-gradient(90deg, ${PIE_COLORS[index % PIE_COLORS.length]}, ${PIE_COLORS[(index + 1) % PIE_COLORS.length]})`,
                          borderRadius: '4px',
                          transition: 'width 0.5s ease'
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Branch Comparison */}
      <div className="card mb-24">
        <div className="card-header">
          <h3 className="card-title">
            <Building2 size={18} />
            مقارنة الفروع (مكة المكرمة vs جدة)
          </h3>
        </div>
        <div className="card-body">
          {branchData.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🏢</div>
              <h3>لا توجد بيانات فروع</h3>
            </div>
          ) : (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={branchData} margin={{ top: 10, right: 30, left: 30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.5)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#94a3b8', fontSize: 13 }}
                    axisLine={{ stroke: '#334155' }}
                  />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    axisLine={{ stroke: '#334155' }}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    formatter={(value) => <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{value}</span>}
                  />
                  <Bar dataKey="الإيرادات" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="المصروفات" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="الربح" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Rejected Quotations */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <FileX size={18} className="text-danger" />
            عروض الأسعار المرفوضة (للمتابعة)
          </h3>
          <span className="badge badge-danger">{rejectedQuotations.length}</span>
        </div>
        <div className="card-body">
          {rejectedQuotations.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✅</div>
              <h3>لا توجد عروض مرفوضة</h3>
              <p>جميع عروض الأسعار مقبولة أو قيد المراجعة</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>العميل</th>
                    <th>عنوان العرض</th>
                    <th>المبلغ</th>
                    <th>سبب الرفض</th>
                    <th>التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {rejectedQuotations.map((q) => (
                    <tr key={q.id}>
                      <td>
                        <span className="font-semibold">{q.clients?.name || '—'}</span>
                      </td>
                      <td>{q.title}</td>
                      <td className="font-bold">{formatCurrency(q.amount)}</td>
                      <td>
                        <span className="text-danger" style={{ fontSize: '0.85rem' }}>
                          {q.rejection_reason || 'غير محدد'}
                        </span>
                      </td>
                      <td className="text-muted">{formatDate(q.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Analytics;
