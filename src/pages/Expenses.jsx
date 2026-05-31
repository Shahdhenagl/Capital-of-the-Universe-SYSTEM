import { useState, useEffect } from 'react';
import { supabase, formatCurrency, formatDate, CITIES, logActivity } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { TrendingDown, Plus, Settings, Search, Calendar, Trash2, X, Edit } from 'lucide-react';
import { notifyTransaction } from '../lib/integrations';

function Expenses() {
  const { profile } = useAuth();

  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
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
    amount: '',
    description: '',
    expense_date: new Date().toISOString().split('T')[0],
    branch: ''
  });

  // Category form
  const [newCategoryName, setNewCategoryName] = useState('');

  useEffect(() => {
    fetchExpenses();
    fetchCategories();
  }, []);

  async function fetchExpenses() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('expenses')
        .select('*, expense_categories(name)')
        .order('expense_date', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (err) {
      console.error('خطأ في جلب المصروفات:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCategories() {
    try {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error('خطأ في جلب الأنواع:', err);
    }
  }

  // Stats calculations
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const dailyTotal = expenses
    .filter(e => e.expense_date === today)
    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  const monthlyTotal = expenses
    .filter(e => {
      const d = new Date(e.expense_date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  const yearlyTotal = expenses
    .filter(e => new Date(e.expense_date).getFullYear() === currentYear)
    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  // Filtered expenses
  const filteredExpenses = expenses.filter(e => {
    if (filterCategory && e.category_id !== filterCategory) return false;
    if (filterDateFrom && e.expense_date < filterDateFrom) return false;
    if (filterDateTo && e.expense_date > filterDateTo) return false;
    if (filterCity && e.branch !== filterCity) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const desc = (e.description || '').toLowerCase();
      const catName = (e.expense_categories?.name || '').toLowerCase();
      const user = (e.created_by_name || '').toLowerCase();
      if (!desc.includes(term) && !catName.includes(term) && !user.includes(term)) return false;
    }
    return true;
  });

  function openAddModal(expense = null) {
    if (expense) {
      setEditingExpense(expense);
      setFormData({
        category_id: expense.category_id || '',
        amount: expense.amount || '',
        description: expense.description || '',
        expense_date: expense.expense_date || new Date().toISOString().split('T')[0],
        branch: expense.branch || ''
      });
    } else {
      setEditingExpense(null);
      setFormData({
        category_id: '',
        amount: '',
        description: '',
        expense_date: new Date().toISOString().split('T')[0],
        branch: profile?.branch || ''
      });
    }
    setShowAddModal(true);
  }

  async function handleSaveExpense(e) {
    e.preventDefault();
    if (!formData.category_id || !formData.amount || !formData.expense_date) return;

    try {
      setSaving(true);
      const payload = {
        category_id: formData.category_id,
        amount: parseFloat(formData.amount),
        description: formData.description,
        expense_date: formData.expense_date,
        branch: formData.branch,
        created_by: profile?.id,
        created_by_name: profile?.full_name
      };

      if (editingExpense) {
        const { error } = await supabase
          .from('expenses')
          .update(payload)
          .eq('id', editingExpense.id);

        if (error) throw error;

        await logActivity(
          profile?.id,
          profile?.full_name,
          'تعديل مصروف',
          'expenses',
          editingExpense.id,
          `تعديل مصروف بمبلغ ${formatCurrency(payload.amount)}`,
          payload.branch
        );

        await notifyTransaction({
          type: 'مصروف',
          action: 'تعديل',
          amount: formatCurrency(payload.amount),
          actor: profile?.full_name || profile?.email,
          branch: CITIES[payload.branch] || payload.branch,
          category: categories.find(cat => cat.id === payload.category_id)?.name,
          description: payload.description,
          date: formatDate(payload.expense_date),
          reference: editingExpense.id,
          link: '/expenses'
        });
      } else {
        const { data, error } = await supabase
          .from('expenses')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;

        await logActivity(
          profile?.id,
          profile?.full_name,
          'إضافة مصروف',
          'expenses',
          data?.id,
          `إضافة مصروف بمبلغ ${formatCurrency(payload.amount)}`,
          payload.branch
        );

        await notifyTransaction({
          type: 'مصروف',
          action: 'إضافة',
          amount: formatCurrency(payload.amount),
          actor: profile?.full_name || profile?.email,
          branch: CITIES[payload.branch] || payload.branch,
          category: categories.find(cat => cat.id === payload.category_id)?.name,
          description: payload.description,
          date: formatDate(payload.expense_date),
          reference: data?.id,
          link: '/expenses'
        });
      }

      setShowAddModal(false);
      setEditingExpense(null);
      fetchExpenses();
    } catch (err) {
      console.error('خطأ في حفظ المصروف:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteExpense(expense) {
    if (!window.confirm('هل أنت متأكد من حذف هذا المصروف؟')) return;

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expense.id);

      if (error) throw error;

      await logActivity(
        profile?.id,
        profile?.full_name,
        'حذف مصروف',
        'expenses',
        expense.id,
        `حذف مصروف بمبلغ ${formatCurrency(expense.amount)}`,
        expense.branch
      );

      await notifyTransaction({
        type: 'مصروف',
        action: 'حذف',
        amount: formatCurrency(expense.amount),
        actor: profile?.full_name || profile?.email,
        branch: CITIES[expense.branch] || expense.branch,
        category: expense.expense_categories?.name,
        description: expense.description,
        date: formatDate(expense.expense_date),
        reference: expense.id,
        link: '/expenses'
      });

      fetchExpenses();
    } catch (err) {
      console.error('خطأ في حذف المصروف:', err);
    }
  }

  async function handleAddCategory(e) {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    try {
      const { error } = await supabase
        .from('expense_categories')
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
        .from('expense_categories')
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
          <span className="title-icon" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
            <TrendingDown size={24} />
          </span>
          المصروفات
        </h1>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => setShowCategoryModal(true)}>
            <Settings size={18} />
            إدارة الأنواع
          </button>
          <button className="btn btn-primary" onClick={() => openAddModal()}>
            <Plus size={18} />
            إضافة مصروف
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-info">
            <div className="stat-label">إجمالي اليوم</div>
            <div className="stat-value">{formatCurrency(dailyTotal)}</div>
          </div>
          <div className="stat-icon primary">
            <Calendar size={24} />
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-info">
            <div className="stat-label">إجمالي الشهر</div>
            <div className="stat-value">{formatCurrency(monthlyTotal)}</div>
          </div>
          <div className="stat-icon warning">
            <TrendingDown size={24} />
          </div>
        </div>

        <div className="stat-card danger">
          <div className="stat-info">
            <div className="stat-label">إجمالي السنة</div>
            <div className="stat-value">{formatCurrency(yearlyTotal)}</div>
          </div>
          <div className="stat-icon danger">
            <TrendingDown size={24} />
          </div>
        </div>

        <div className="stat-card info">
          <div className="stat-info">
            <div className="stat-label">عدد المعاملات</div>
            <div className="stat-value">{expenses.length}</div>
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
            placeholder="بحث في المصروفات..."
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
        ) : filteredExpenses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <h3>لا توجد مصروفات</h3>
            <p>لم يتم العثور على مصروفات مطابقة للبحث</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>النوع</th>
                <th>الوصف</th>
                <th>المبلغ</th>
                <th>الفرع</th>
                <th>بواسطة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map(expense => (
                <tr key={expense.id}>
                  <td>{formatDate(expense.expense_date)}</td>
                  <td>
                    <span className="badge badge-info">
                      {expense.expense_categories?.name || '-'}
                    </span>
                  </td>
                  <td>{expense.description || '-'}</td>
                  <td>
                    <strong>{formatCurrency(expense.amount)}</strong>
                  </td>
                  <td>{CITIES[expense.branch] || expense.branch || '-'}</td>
                  <td>{expense.created_by_name || '-'}</td>
                  <td>
                    <div className="page-actions">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => openAddModal(expense)}
                        title="تعديل"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleDeleteExpense(expense)}
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

      {/* Add/Edit Expense Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingExpense ? 'تعديل مصروف' : 'إضافة مصروف جديد'}
              </h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveExpense}>
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
                    <label className="form-label">تاريخ المصروف *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.expense_date}
                      onChange={e => setFormData({ ...formData, expense_date: e.target.value })}
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
                    placeholder="وصف المصروف..."
                    rows={3}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'جاري الحفظ...' : editingExpense ? 'تحديث' : 'إضافة'}
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
              <h2 className="modal-title">إدارة أنواع المصروفات</h2>
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

export default Expenses;
