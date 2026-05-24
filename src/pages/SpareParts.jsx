import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, formatCurrency, CITIES, logActivity } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Package, Plus, FileText, Search, Edit, Trash2, AlertTriangle, X } from 'lucide-react';

function SpareParts() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    part_number: '',
    buy_price: '',
    sell_price: '',
    quantity: '',
    min_quantity: '',
    category: '',
    branch: 'mecca',
    notes: ''
  });

  useEffect(() => {
    fetchParts();
  }, []);

  async function fetchParts() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('spare_parts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setParts(data || []);
    } catch (err) {
      console.error('Error fetching spare parts:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredParts = parts.filter(part => {
    const matchesSearch = !searchTerm ||
      part.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      part.part_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBranch = !branchFilter || part.branch === branchFilter;
    return matchesSearch && matchesBranch;
  });

  const totalParts = parts.length;
  const inventoryValue = parts.reduce((sum, p) => sum + (p.buy_price || 0) * (p.quantity || 0), 0);
  const expectedProfit = parts.reduce((sum, p) => sum + ((p.sell_price || 0) - (p.buy_price || 0)) * (p.quantity || 0), 0);
  const lowStockCount = parts.filter(p => p.quantity <= (p.min_quantity || 0)).length;

  function getMargin(part) {
    if (!part.buy_price || part.buy_price === 0) return '0%';
    return ((part.sell_price - part.buy_price) / part.buy_price * 100).toFixed(1) + '%';
  }

  function openAddModal() {
    setEditingPart(null);
    setFormData({
      name: '',
      part_number: '',
      buy_price: '',
      sell_price: '',
      quantity: '',
      min_quantity: '',
      category: '',
      branch: 'mecca',
      notes: ''
    });
    setShowModal(true);
  }

  function openEditModal(part) {
    setEditingPart(part);
    setFormData({
      name: part.name || '',
      part_number: part.part_number || '',
      buy_price: part.buy_price || '',
      sell_price: part.sell_price || '',
      quantity: part.quantity || '',
      min_quantity: part.min_quantity || '',
      category: part.category || '',
      branch: part.branch || 'mecca',
      notes: part.notes || ''
    });
    setShowModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const record = {
        name: formData.name,
        part_number: formData.part_number,
        buy_price: parseFloat(formData.buy_price) || 0,
        sell_price: parseFloat(formData.sell_price) || 0,
        quantity: parseInt(formData.quantity) || 0,
        min_quantity: parseInt(formData.min_quantity) || 0,
        category: formData.category,
        branch: formData.branch,
        notes: formData.notes
      };

      if (editingPart) {
        const { error } = await supabase
          .from('spare_parts')
          .update(record)
          .eq('id', editingPart.id);
        if (error) throw error;
        await logActivity(profile?.id, profile?.full_name, 'تعديل', 'قطع الغيار', editingPart.id, `تم تعديل القطعة: ${formData.name}`, formData.branch);
      } else {
        const { error } = await supabase
          .from('spare_parts')
          .insert(record);
        if (error) throw error;
        await logActivity(profile?.id, profile?.full_name, 'إضافة', 'قطع الغيار', null, `تم إضافة قطعة جديدة: ${formData.name}`, formData.branch);
      }

      setShowModal(false);
      fetchParts();
    } catch (err) {
      console.error('Error saving spare part:', err);
      alert('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(part) {
    if (!window.confirm(`هل أنت متأكد من حذف "${part.name}"؟`)) return;
    try {
      const { error } = await supabase
        .from('spare_parts')
        .delete()
        .eq('id', part.id);
      if (error) throw error;
      await logActivity(profile?.id, profile?.full_name, 'حذف', 'قطع الغيار', part.id, `تم حذف القطعة: ${part.name}`, part.branch);
      fetchParts();
    } catch (err) {
      console.error('Error deleting spare part:', err);
      alert('حدث خطأ أثناء الحذف');
    }
  }

  if (loading) {
    return (
      <div className="loading-inline">
        <div className="loader"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          <span className="title-icon" style={{ background: 'var(--primary-bg)', color: 'var(--primary-light)' }}>
            <Package size={28} />
          </span>
          قطع الغيار
        </h1>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => navigate('/spare-parts/invoice')}>
            <FileText size={18} />
            فاتورة بيع
          </button>
          <button className="btn btn-primary" onClick={openAddModal}>
            <Plus size={18} />
            إضافة قطعة
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-info">
            <div className="stat-label">إجمالي القطع</div>
            <div className="stat-value">{totalParts}</div>
          </div>
          <div className="stat-icon primary">
            <Package size={28} />
          </div>
        </div>
        <div className="stat-card success">
          <div className="stat-info">
            <div className="stat-label">قيمة المخزون</div>
            <div className="stat-value">{formatCurrency(inventoryValue)}</div>
          </div>
          <div className="stat-icon success">
            <Package size={28} />
          </div>
        </div>
        <div className="stat-card info">
          <div className="stat-info">
            <div className="stat-label">هامش الربح المتوقع</div>
            <div className="stat-value">{formatCurrency(expectedProfit)}</div>
          </div>
          <div className="stat-icon info">
            <FileText size={28} />
          </div>
        </div>
        <div className="stat-card danger">
          <div className="stat-info">
            <div className="stat-label">قطع منخفضة المخزون</div>
            <div className="stat-value">{lowStockCount}</div>
          </div>
          <div className="stat-icon danger">
            <AlertTriangle size={28} />
          </div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="بحث بالاسم أو رقم القطعة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
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
      </div>

      <div className="table-container">
        {filteredParts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <h3>لا توجد قطع غيار</h3>
            <p>قم بإضافة قطع غيار جديدة لتظهر هنا</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>اسم القطعة</th>
                <th>رقم القطعة</th>
                <th>سعر الشراء</th>
                <th>سعر البيع</th>
                <th>هامش الربح</th>
                <th>الكمية</th>
                <th>الفرع</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredParts.map(part => (
                <tr key={part.id}>
                  <td>
                    <span className="font-semibold">{part.name}</span>
                  </td>
                  <td>{part.part_number || '—'}</td>
                  <td>{formatCurrency(part.buy_price)}</td>
                  <td>{formatCurrency(part.sell_price)}</td>
                  <td>
                    <span className="text-success font-semibold">{getMargin(part)}</span>
                  </td>
                  <td>
                    <span className={part.quantity <= (part.min_quantity || 0) ? 'text-danger font-bold' : ''}>
                      {part.quantity}
                      {part.quantity <= (part.min_quantity || 0) && (
                        <AlertTriangle size={14} className="text-danger" />
                      )}
                    </span>
                  </td>
                  <td>{CITIES[part.branch] || part.branch}</td>
                  <td>
                    <div className="flex gap-8">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(part)}>
                        <Edit size={16} />
                      </button>
                      <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(part)}>
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

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingPart ? 'تعديل قطعة غيار' : 'إضافة قطعة غيار جديدة'}
              </h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">اسم القطعة *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">رقم القطعة</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.part_number}
                      onChange={(e) => setFormData({ ...formData, part_number: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">سعر الشراء *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.buy_price}
                      onChange={(e) => setFormData({ ...formData, buy_price: e.target.value })}
                      required
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">سعر البيع *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.sell_price}
                      onChange={(e) => setFormData({ ...formData, sell_price: e.target.value })}
                      required
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">الكمية *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      required
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">الحد الأدنى للمخزون</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.min_quantity}
                      onChange={(e) => setFormData({ ...formData, min_quantity: e.target.value })}
                      min="0"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">الفئة</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="مثال: محركات، كابلات، أبواب..."
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">الفرع *</label>
                    <select
                      className="form-select"
                      value={formData.branch}
                      onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                      required
                    >
                      {Object.entries(CITIES).map(([key, val]) => (
                        <option key={key} value={key}>{val}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">ملاحظات</label>
                  <textarea
                    className="form-textarea"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'جاري الحفظ...' : (editingPart ? 'تحديث' : 'إضافة')}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default SpareParts;
