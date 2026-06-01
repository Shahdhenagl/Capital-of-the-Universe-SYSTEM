import { useState, useEffect } from 'react';
import { supabase, formatCurrency, formatDate, CITIES, logActivity } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { TrendingUp, Plus, Settings, Search, Calendar, Trash2, X, Edit } from 'lucide-react';
import { notifyTransaction } from '../lib/integrations';

function Revenue({ cityFilter = 'all' }) {
  const { profile } = useAuth();

  const [revenues, setRevenues] = useState([]);
  const [categories, setCategories] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingRevenue, setEditingRevenue] = useState(null);
  const [saving, setSaving] = useState(false);

  // Filters
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Add form
  const [formData, setFormData] = useState({
    category_id: '',
    client_id: '',
    amount: '',
    description: '',
    revenue_date: new Date().toISOString().split('T')[0],
    branch: ''
  });

  // Category form
  const [newCategoryName, setNewCategoryName] = useState('');

  useEffect(() => {
    fetchRevenues();
    fetchCategories();
    fetchClients();
  }, []);

  useEffect(() => {
    setFilterCity(cityFilter === 'all' ? '' : cityFilter);
  }, [cityFilter]);

  async function fetchRevenues() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('revenues')
        .select('*, revenue_categories(name), clients(name)')
        .order('revenue_date', { ascending: false });

      if (error) throw error;
      setRevenues(data || []);
    } catch (err) {
      console.error('خطأ في جلب الإيرادات:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCategories() {
    try {
      const { data, error } = await supabase
        .from('revenue_categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error('خطأ في جلب الأنواع:', err);
    }
  }

  async function fetchClients() {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .neq('status', 'inactive')
        .order('name');

      if (error) throw error;
      setClients(data || []);
    } catch (err) {
      console.error('خطأ في جلب العملاء:', err);
    }
  }

  // Stats calculations
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const dailyTotal = revenues
    .filter(r => r.revenue_date === today)
    .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  const monthlyTotal = revenues
    .filter(r => {
      const d = new Date(r.revenue_date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  const yearlyTotal = revenues
    .filter(r => new Date(r.revenue_date).getFullYear() === currentYear)
    .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  // Filtered revenues
  const filteredRevenues = revenues.filter(r => {
    if (filterCategory && r.category_id !== filterCategory) return false;
    if (filterDateFrom && r.revenue_date < filterDateFrom) return false;
    if (filterDateTo && r.revenue_date > filterDateTo) return false;
    if (filterCity && r.branch !== filterCity) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const desc = (r.description || '').toLowerCase();
      const catName = (r.revenue_categories?.name || '').toLowerCase();
      const clientName = (r.clients?.name || '').toLowerCase();
      const user = (r.created_by_name || '').toLowerCase();
      if (!desc.includes(term) && !catName.includes(term) && !clientName.includes(term) && !user.includes(term)) return false;
    }
    return true;
  });

  function openAddModal(revenue = null) {
    if (revenue) {
      setEditingRevenue(revenue);
      setFormData({
        category_id: revenue.category_id || '',
        client_id: revenue.client_id || '',
        amount: revenue.amount || '',
        description: revenue.description || '',
        revenue_date: revenue.revenue_date || new Date().toISOString().split('T')[0],
        branch: revenue.branch || ''
      });
    } else {
      setEditingRevenue(null);
      setFormData({
        category_id: '',
        client_id: '',
        amount: '',
        description: '',
        revenue_date: new Date().toISOString().split('T')[0],
        branch: profile?.branch || ''
      });
    }
    setShowAddModal(true);
  }

  async function handleSaveRevenue(e) {
    e.preventDefault();
    if (!formData.category_id || !formData.amount || !formData.revenue_date) return;

    try {
      setSaving(true);
      const payload = {
        category_id: formData.category_id,
        client_id: formData.client_id || null,
        amount: parseFloat(formData.amount),
        description: formData.description,
        revenue_date: formData.revenue_date,
        branch: formData.branch,
        created_by: profile?.id,
        created_by_name: profile?.full_name
      };

      if (editingRevenue) {
        const { error } = await supabase
          .from('revenues')
          .update(payload)
          .eq('id', editingRevenue.id);

        if (error) throw error;

        await logActivity(
          profile?.id,
          profile?.full_name,
          'تعديل إيراد',
          'revenues',
          editingRevenue.id,
          `تعديل إيراد بمبلغ ${formatCurrency(payload.amount)}`,
          payload.branch
        );

        await notifyTransaction({
          type: 'إيراد',
          action: 'تعديل',
          amount: formatCurrency(payload.amount),
          actor: profile?.full_name || profile?.email,
          branch: CITIES[payload.branch] || payload.branch,
          category: categories.find(cat => cat.id === payload.category_id)?.name,
          client: clients.find(client => client.id === payload.client_id)?.name,
          description: payload.description,
          date: formatDate(payload.revenue_date),
          reference: editingRevenue.id,
          link: '/revenue'
        });
      } else {
        const { data, error } = await supabase
          .from('revenues')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;

        await logActivity(
          profile?.id,
          profile?.full_name,
          'إضافة إيراد',
          'revenues',
          data?.id,
          `إضافة إيراد بمبلغ ${formatCurrency(payload.amount)}`,
          payload.branch
        );

        await notifyTransaction({
          type: 'إيراد',
          action: 'إضافة',
          amount: formatCurrency(payload.amount),
          actor: profile?.full_name || profile?.email,
          branch: CITIES[payload.branch] || payload.branch,
          category: categories.find(cat => cat.id === payload.category_id)?.name,
          client: clients.find(client => client.id === payload.client_id)?.name,
          description: payload.description,
          date: formatDate(payload.revenue_date),
          reference: data?.id,
          link: '/revenue'
        });
      }

      setShowAddModal(false);
      setEditingRevenue(null);
      fetchRevenues();
    } catch (err) {
      console.error('خطأ في حفظ الإيراد:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRevenue(revenue) {
    if (!window.confirm('هل أنت متأكد من حذف هذا الإيراد؟')) return;

    try {
      const { error } = await supabase
        .from('revenues')
        .delete()
        .eq('id', revenue.id);

      if (error) throw error;

      await logActivity(
        profile?.id,
        profile?.full_name,
        'حذف إيراد',
        'revenues',
        revenue.id,
        `حذف إيراد بمبلغ ${formatCurrency(revenue.amount)}`,
        revenue.branch
      );

      await notifyTransaction({
        type: 'إيراد',
        action: 'حذف',
        amount: formatCurrency(revenue.amount),
        actor: profile?.full_name || profile?.email,
        branch: CITIES[revenue.branch] || revenue.branch,
        category: revenue.revenue_categories?.name,
        client: revenue.clients?.name,
        description: revenue.description,
        date: formatDate(revenue.revenue_date),
        reference: revenue.id,
        link: '/revenue'
      });

      fetchRevenues();
    } catch (err) {
      console.error('خطأ في حذف الإيراد:', err);
    }
  }

  async function handleAddCategory(e) {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    try {
      const { error } = await supabase
        .from('revenue_categories')
        .insert({ name: newCategoryName.trim() });

      if (error) throw error;

      setNewCategoryName('');
      fetchCategories();
    } catch (err) {
      console.error('خطأ في إضافة النوع:', err);
    }
  }

  async function handleDeleteCategory(id) {
    if (!window.confirm('هل أنت متأكد من حذف هذا النوع؟')) return;

    try {
      const { error } = await supabase
        .from('revenue_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchCategories();
    } catch (err) {
      console.error('خطأ في حذف النوع:', err);
    }
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">
          <span className="title-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
            <TrendingUp size={24} />
          </span>
          الإيرادات
        </h1>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => setShowCategoryModal(true)}>
            <Settings size={18} />
            إدارة الأنواع
          </button>
          <button className="btn btn-primary" onClick={() => openAddModal()}>
            <Plus size={18} />
            إضافة إيراد
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card success">
          <div className="stat-info">
            <div className="stat-label">إجمالي اليوم</div>
            <div className="stat-value">{formatCurrency(dailyTotal)}</div>
          </div>
          <div className="stat-icon success">
            <Calendar size={24} />
          </div>
        </div>

        <div className="stat-card primary">
          <div className="stat-info">
            <div className="stat-label">إجمالي الشهر</div>
            <div className="stat-value">{formatCurrency(monthlyTotal)}</div>
          </div>
          <div className="stat-icon primary">
            <TrendingUp size={24} />
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-info">
            <div className="stat-label">إجمالي السنة</div>
            <div className="stat-value">{formatCurrency(yearlyTotal)}</div>
          </div>
          <div className="stat-icon warning">
            <TrendingUp size={24} />
          </div>
        </div>

        <div className="stat-card info">
          <div className="stat-info">
            <div className="stat-label">عدد المعاملات</div>
            <div className="stat-value">{revenues.length}</div>
          </div>
          <div className="stat-icon info">
            <Settings size={24} />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="filter-group">
          <select
            className="form-select"
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
          >
            <option value="">كل الأنواع</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <input
            type="date"
            className="form-input"
            value={filterDateFrom}
            onChange={e => setFilterDateFrom(e.target.value)}
            placeholder="من تاريخ"
          />
        </div>

        <div className="filter-group">
          <input
            type="date"
            className="form-input"
            value={filterDateTo}
            onChange={e => setFilterDateTo(e.target.value)}
            placeholder="إلى تاريخ"
          />
        </div>

        <div className="filter-group">
          <select
            className="form-select"
            value={filterCity}
            onChange={e => setFilterCity(e.target.value)}
          >
            <option value="">كل الفروع</option>
            {Object.entries(CITIES).map(([key, val]) => (
              <option key={key} value={key}>{val}</option>
            ))}
          </select>
        </div>

        <div className="filter-group search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="form-input search-input"
            placeholder="بحث في الإيرادات..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="table-container">
        {loading ? (
          <div className="empty-state">
            <p>جاري التحميل...</p>
          </div>
        ) : filteredRevenues.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <h3>لا توجد إيرادات</h3>
            <p>لم يتم العثور على إيرادات مطابقة للبحث</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>النوع</th>
                <th>العميل</th>
                <th>الوصف</th>
                <th>المبلغ</th>
                <th>الفرع</th>
                <th>بواسطة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredRevenues.map(revenue => (
                <tr key={revenue.id}>
                  <td>{formatDate(revenue.revenue_date)}</td>
                  <td>
                    <span className="badge badge-success">
                      {revenue.revenue_categories?.name || '-'}
                    </span>
                  </td>
                  <td>{revenue.clients?.name || '-'}</td>
                  <td>{revenue.description || '-'}</td>
                  <td>
                    <strong>{formatCurrency(revenue.amount)}</strong>
                  </td>
                  <td>{CITIES[revenue.branch] || revenue.branch || '-'}</td>
                  <td>{revenue.created_by_name || '-'}</td>
                  <td>
                    <div className="page-actions">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => openAddModal(revenue)}
                        title="تعديل"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleDeleteRevenue(revenue)}
                        title="حذف"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Revenue Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingRevenue ? 'تعديل إيراد' : 'إضافة إيراد جديد'}
              </h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveRevenue}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">النوع *</label>
                  <select
                    className="form-select"
                    value={formData.category_id}
                    onChange={e => setFormData({ ...formData, category_id: e.target.value })}
                    required
                  >
                    <option value="">اختر النوع</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">العميل</label>
                  <select
                    className="form-select"
                    value={formData.client_id}
                    onChange={e => setFormData({ ...formData, client_id: e.target.value })}
                  >
                    <option value="">بدون عميل</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">المبلغ *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.amount}
                      onChange={e => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">تاريخ الإيراد *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.revenue_date}
                      onChange={e => setFormData({ ...formData, revenue_date: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">الفرع</label>
                  <select
                    className="form-select"
                    value={formData.branch}
                    onChange={e => setFormData({ ...formData, branch: e.target.value })}
                  >
                    <option value="">اختر الفرع</option>
                    {Object.entries(CITIES).map(([key, val]) => (
                      <option key={key} value={key}>{val}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">الوصف</label>
                  <textarea
                    className="form-textarea"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="وصف الإيراد..."
                    rows={3}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'جاري الحفظ...' : editingRevenue ? 'تحديث' : 'إضافة'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Manager Modal */}
      {showCategoryModal && (
        <div className="modal-overlay" onClick={() => setShowCategoryModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">إدارة أنواع الإيرادات</h2>
              <button className="modal-close" onClick={() => setShowCategoryModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* Add new category */}
              <form onSubmit={handleAddCategory}>
                <div className="form-group">
                  <label className="form-label">إضافة نوع جديد</label>
                  <div className="filter-group">
                    <input
                      type="text"
                      className="form-input"
                      value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                      placeholder="اسم النوع..."
                    />
                    <button type="submit" className="btn btn-primary btn-sm">
                      <Plus size={16} />
                      إضافة
                    </button>
                  </div>
                </div>
              </form>

              {/* Categories list */}
              <div className="form-group">
                <label className="form-label">الأنواع الحالية</label>
                {categories.length === 0 ? (
                  <p className="form-hint">لا توجد أنواع بعد</p>
                ) : (
                  categories.map(cat => (
                    <div key={cat.id} className="table-row" style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border)'
                    }}>
                      <span>{cat.name}</span>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleDeleteCategory(cat.id)}
                        title="حذف"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowCategoryModal(false)}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Revenue;
