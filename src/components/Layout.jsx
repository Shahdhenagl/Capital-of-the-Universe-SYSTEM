import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  LayoutDashboard, Users, FileText, Wallet, TrendingDown, TrendingUp,
  Package, UserCog, BarChart3, Bell, Activity, Shield, LogOut,
  Menu, X, ChevronLeft, Building2, FileCheck, Coins, Plug, BriefcaseBusiness, Calendar
} from 'lucide-react';

const navItems = [
  { section: 'الرئيسية' },
  { path: '/', label: 'لوحة التحكم', icon: LayoutDashboard, permission: 'dashboard.view' },
  { path: '/analytics', label: 'التحليلات', icon: BarChart3, permission: 'analytics.view' },
  
  { section: 'إدارة العملاء' },
  { path: '/clients', label: 'العملاء', icon: Users, permission: 'clients.view' },
  { path: '/quotations', label: 'عروض الأسعار', icon: FileText, permission: 'quotations.view' },
  { path: '/contracts', label: 'العقود', icon: FileCheck, permission: 'contracts.view' },
  { path: '/maintenance', label: 'حركات الصيانة', icon: Calendar, permission: 'maintenance.view' },
  { path: '/installations', label: 'مراحل التركيب', icon: BriefcaseBusiness, permission: 'maintenance.view' },
  { path: '/collections', label: 'التحصيلات', icon: Wallet, permission: 'collections.view' },
  
  { section: 'المالية' },
  { path: '/expenses', label: 'المصروفات', icon: TrendingDown, permission: 'expenses.view' },
  { path: '/revenue', label: 'الإيرادات', icon: TrendingUp, permission: 'revenue.view' },
  { path: '/spare-parts', label: 'قطع الغيار', icon: Package, permission: 'spare_parts.view' },
  { path: '/payroll', label: 'الرواتب والأجور', icon: Coins, permission: 'payroll.view' },
  
  { section: 'الإدارة' },
  { path: '/employees', label: 'الموظفين', icon: UserCog, permission: 'employees.view' },
  { path: '/services', label: 'أنواع الخدمات', icon: BriefcaseBusiness, permission: 'services.view' },
  { path: '/users', label: 'المستخدمين', icon: Shield, adminOnly: true },
  { path: '/activity-log', label: 'سجل الأنشطة', icon: Activity, permission: 'activity_log.view' },
  { path: '/notifications', label: 'الإشعارات', icon: Bell },
  { path: '/integrations', label: 'التكاملات', icon: Plug, adminOnly: true },
];

export default function Layout({ children, cityFilter, setCityFilter }) {
  const { profile, logout, isAdmin, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (profile) {
      fetchNotificationCount();
      const interval = setInterval(fetchNotificationCount, 60000);
      
      // Run weekly collections check once on load/login
      const alreadyChecked = sessionStorage.getItem('weekly_collections_checked');
      if (!alreadyChecked) {
        import('../lib/integrations').then(({ checkWeeklyCollections, checkLowStockParts, checkUpcomingVisits, checkDelayedInstallations }) => {
          checkWeeklyCollections(profile.id, profile.full_name, profile.branch);
          checkLowStockParts(profile.id, profile.full_name, profile.branch);
          checkUpcomingVisits(profile.id, profile.full_name, profile.branch);
          checkDelayedInstallations(profile.id, profile.full_name, profile.branch);
          sessionStorage.setItem('weekly_collections_checked', 'true');
        }).catch(err => console.error(err));
      }

      return () => clearInterval(interval);
    }
  }, [profile]);

  async function fetchNotificationCount() {
    try {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('is_read', false);
      setNotifCount(count || 0);
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchNotifications() {
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(10);
      setNotifications(data || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function toggleNotifDropdown() {
    if (!showNotifDropdown) {
      await fetchNotifications();
    }
    setShowNotifDropdown(!showNotifDropdown);
  }

  async function markNotifRead(notif) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
    setNotifCount(prev => Math.max(0, prev - 1));
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
    if (notif.link) navigate(notif.link);
    setShowNotifDropdown(false);
  }

  function getPageTitle() {
    const current = navItems.find(item => item.path && item.path === location.pathname);
    return current?.label || 'لوحة التحكم';
  }

  function getTimeAgo(date) {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'الآن';
    if (mins < 60) return `منذ ${mins} دقيقة`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `منذ ${hours} ساعة`;
    const days = Math.floor(hours / 24);
    return `منذ ${days} يوم`;
  }

  const notifTypeIcons = {
    info: { bg: 'var(--info-bg)', color: 'var(--info-light)' },
    warning: { bg: 'var(--warning-bg)', color: 'var(--warning-light)' },
    danger: { bg: 'var(--danger-bg)', color: 'var(--danger-light)' },
    success: { bg: 'var(--success-bg)', color: 'var(--success-light)' },
  };

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img className="app-logo-img" src="/logo-transparent.png" alt="عاصمة الكون FUJI-YEM Elevators" />
            <div>
              <h1>عاصمة الكون</h1>
              <span className="logo-subtitle">نظام إدارة المصاعد</span>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item, idx) => {
            if (item.section) {
              return <div key={idx} className="nav-section-title">{item.section}</div>;
            }
            if (item.adminOnly && !isAdmin) return null;
            if (item.permission && !hasPermission(item.permission)) return null;
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  navigate(item.path);
                  setSidebarOpen(false);
                }}
              >
                <span className="nav-icon"><Icon size={20} /></span>
                {item.label}
                {item.path === '/notifications' && notifCount > 0 && (
                  <span className="nav-badge">{notifCount}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {profile?.full_name?.charAt(0) || '؟'}
            </div>
            <div className="user-details">
              <div className="user-name">{profile?.full_name || 'مستخدم'}</div>
              <div className="user-role">
                {profile?.role === 'admin' ? 'مدير النظام' : profile?.role === 'accountant' ? 'محاسب' : 'مشاهد'}
              </div>
            </div>
            <button className="logout-btn" onClick={handleLogout} title="تسجيل الخروج">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-content">
        {/* Navbar */}
        <header className="navbar">
          <div className="navbar-right">
            <button
              className="btn-ghost btn-icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{ display: 'none' }}
            >
              <Menu size={22} />
            </button>
            <h2 className="navbar-title">{getPageTitle()}</h2>
          </div>

          <div className="navbar-left">
            {/* City Filter */}
            <div className="city-filter-navbar">
              <button
                className={`city-filter-btn ${cityFilter === 'all' ? 'active' : ''}`}
                onClick={() => setCityFilter('all')}
              >
                الكل
              </button>
              <button
                className={`city-filter-btn ${cityFilter === 'mecca' ? 'active' : ''}`}
                onClick={() => setCityFilter('mecca')}
              >
                مكة
              </button>
              <button
                className={`city-filter-btn ${cityFilter === 'jeddah' ? 'active' : ''}`}
                onClick={() => setCityFilter('jeddah')}
              >
                جدة
              </button>
            </div>

            {/* Notifications */}
            <div style={{ position: 'relative' }}>
              <button className="notification-bell" onClick={toggleNotifDropdown}>
                <Bell size={22} />
                {notifCount > 0 && (
                  <span className="notification-count">{notifCount > 99 ? '99+' : notifCount}</span>
                )}
              </button>

              {showNotifDropdown && (
                <div className="notification-dropdown">
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700 }}>الإشعارات</span>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => navigate('/notifications')}
                    >
                      عرض الكل
                    </button>
                  </div>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                      لا توجد إشعارات
                    </div>
                  ) : (
                    notifications.map(notif => {
                      const typeStyle = notifTypeIcons[notif.type] || notifTypeIcons.info;
                      return (
                        <div
                          key={notif.id}
                          className={`notification-item ${!notif.is_read ? 'unread' : ''}`}
                          onClick={() => markNotifRead(notif)}
                        >
                          <div
                            className="notif-icon"
                            style={{ background: typeStyle.bg, color: typeStyle.color }}
                          >
                            <Bell size={16} />
                          </div>
                          <div className="notif-content">
                            <div className="notif-title">{notif.title}</div>
                            <div className="notif-message">{notif.message}</div>
                            <div className="notif-time">{getTimeAgo(notif.created_at)}</div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="page-content">
          {children}
        </main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="modal-overlay"
          style={{ zIndex: 99 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
