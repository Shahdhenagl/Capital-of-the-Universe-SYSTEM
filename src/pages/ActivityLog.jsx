import { useState, useEffect } from 'react';
import { supabase, CITIES, formatDate } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Activity, Search, Filter, Calendar } from 'lucide-react';

function ActivityLog({ cityFilter = 'all' }) {
  const { profile } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchUser, setSearchUser] = useState('');

  const MODULES = [
    { key: '', label: 'الكل' },
    { key: 'عملاء', label: 'عملاء' },
    { key: 'عروض أسعار', label: 'عروض أسعار' },
    { key: 'عقود', label: 'عقود' },
    { key: 'تحصيل', label: 'تحصيل' },
    { key: 'إيرادات', label: 'إيرادات' },
    { key: 'مصروفات', label: 'مصروفات' },
    { key: 'قطع الغيار', label: 'قطع الغيار' },
    { key: 'فواتير قطع الغيار', label: 'فواتير قطع الغيار' },
    { key: 'الموظفين', label: 'الموظفين' },
    { key: 'المستخدمين', label: 'المستخدمين' },
    { key: 'الصيانة', label: 'الصيانة' }
  ];

  useEffect(() => {
    fetchActivities();
  }, [moduleFilter, branchFilter, dateFrom, dateTo, searchUser]);

  useEffect(() => {
    setBranchFilter(cityFilter === 'all' ? '' : cityFilter);
  }, [cityFilter]);

  async function fetchActivities() {
    try {
      setLoading(true);
      let query = supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (moduleFilter) {
        query = query.eq('module', moduleFilter);
      }

      if (branchFilter) {
        query = query.eq('branch', branchFilter);
      }

      if (dateFrom) {
        query = query.gte('created_at', dateFrom + 'T00:00:00');
      }

      if (dateTo) {
        query = query.lte('created_at', dateTo + 'T23:59:59');
      }

      if (searchUser) {
        query = query.ilike('user_name', `%${searchUser}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setActivities(data || []);
    } catch (err) {
      console.error('Error fetching activities:', err);
    } finally {
      setLoading(false);
    }
  }

  function formatDateTime(date) {
    if (!date) return '';
    return new Date(date).toLocaleString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function getActionBadge(action) {
    if (action?.includes('إضافة') || action?.includes('إنشاء')) return 'badge badge-success';
    if (action?.includes('تعديل') || action?.includes('تحديث')) return 'badge badge-warning';
    if (action?.includes('حذف')) return 'badge badge-danger';
    return 'badge badge-info';
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          <span className="title-icon" style={{ background: 'var(--primary-bg)', color: 'var(--primary-light)' }}>
            <Activity size={28} />
          </span>
          سجل الأنشطة
        </h1>
      </div>

      <div className="filter-bar">
        <div className="search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="بحث بالمستخدم..."
            value={searchUser}
            onChange={(e) => setSearchUser(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <Filter size={16} />
          <select
            className="form-select"
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
          >
            {MODULES.map(mod => (
              <option key={mod.key} value={mod.key}>{mod.label}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <select
            className="form-select"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
          >
            <option value="">كل الفروع</option>
            {Object.entries(CITIES).map(([key, val]) => (
              <option key={key} value={key}>{val}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <Calendar size={16} />
          <input
            type="date"
            className="form-input"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="من تاريخ"
          />
        </div>
        <div className="filter-group">
          <input
            type="date"
            className="form-input"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="إلى تاريخ"
          />
        </div>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="loading-inline">
            <div className="loader"></div>
          </div>
        ) : activities.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>لا توجد أنشطة</h3>
            <p>لم يتم تسجيل أي نشاط بعد أو لا توجد نتائج للفلترة المحددة</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>التاريخ والوقت</th>
                <th>المستخدم</th>
                <th>العملية</th>
                <th>الموديول</th>
                <th>التفاصيل</th>
                <th>الفرع</th>
              </tr>
            </thead>
            <tbody>
              {activities.map(activity => (
                <tr key={activity.id}>
                  <td className="text-muted">
                    {formatDateTime(activity.created_at)}
                  </td>
                  <td>
                    <span className="font-semibold">{activity.user_name || '—'}</span>
                  </td>
                  <td>
                    <span className={getActionBadge(activity.action)}>
                      {activity.action}
                    </span>
                  </td>
                  <td>{activity.module || '—'}</td>
                  <td>
                    <span className="text-muted">{activity.details || '—'}</span>
                  </td>
                  <td>{CITIES[activity.branch] || activity.branch || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default ActivityLog;
