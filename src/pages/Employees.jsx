import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, formatCurrency, formatDate, CITIES, POSITIONS, logActivity } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Users, Plus, Search, Phone, MapPin, Briefcase, Edit, Trash2, X } from 'lucide-react';
import { formatSaudiLocalPhoneInput, isValidSaudiLocalPhone } from '../lib/integrations';

function Employees({ cityFilter = 'all' }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    position: 'technician',
    branch: 'mecca',
    salary: '',
    annual_leave_days: 0,
    hire_date: '',
    notes: ''
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    setBranchFilter(cityFilter === 'all' ? '' : cityFilter);
  }, [cityFilter]);

  async function fetchEmployees() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEmployees(data || []);
    } catch (err) {
      console.error('Error fetching employees:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = !searchTerm ||
      emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.phone?.includes(searchTerm);
    const matchesPosition = !positionFilter || emp.position === positionFilter;
    const matchesBranch = !branchFilter || emp.branch === branchFilter;
    return matchesSearch && matchesPosition && matchesBranch;
  });

  const totalEmployees = employees.length;
  const technicians = employees.filter(e => e.position === 'technician').length;
  const admins = employees.filter(e => e.position === 'admin').length;
  const meccaCount = employees.filter(e => e.branch === 'mecca').length;
  const jeddahCount = employees.filter(e => e.branch === 'jeddah').length;

  function getPositionBadge(position) {
    const badges = {
      technician: 'badge badge-info',
      admin: 'badge badge-primary',
      accountant: 'badge badge-success',
      manager: 'badge badge-warning',
      other: 'badge badge-secondary'
    };
    return badges[position] || 'badge badge-secondary';
  }

  function openAddModal() {
    setEditingEmployee(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
      position: 'technician',
      branch: 'mecca',
      salary: '',
      annual_leave_days: 0,
      hire_date: '',
      notes: ''
    });
    setShowModal(true);
  }

  function openEditModal(emp) {
    setEditingEmployee(emp);
    setFormData({
      name: emp.name || '',
      phone: emp.phone || '',
      email: emp.email || '',
      position: emp.position || 'technician',
      branch: emp.branch || 'mecca',
      salary: emp.salary || '',
      annual_leave_days: emp.annual_leave_days || 0,
      hire_date: emp.hire_date || '',
      notes: emp.notes || ''
    });
    setShowModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (formData.phone && !isValidSaudiLocalPhone(formData.phone)) {
      alert('رقم الهاتف يجب أن يكون 9 أرقام ويبدأ بـ 5');
      return;
    }
    setSaving(true);
    try {
      const record = {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        position: formData.position,
        branch: formData.branch,
        salary: parseFloat(formData.salary) || 0,
        annual_leave_days: parseInt(formData.annual_leave_days) || 0,
        hire_date: formData.hire_date || null,
        notes: formData.notes
      };

      if (editingEmployee) {
        const { error } = await supabase
          .from('employees')
          .update(record)
          .eq('id', editingEmployee.id);
        if (error) throw error;
        await logActivity(profile?.id, profile?.full_name, 'تعديل', 'الموظفين', editingEmployee.id, `تم تعديل بيانات الموظف: ${formData.name}`, formData.branch);
      } else {
        const { error } = await supabase
          .from('employees')
          .insert(record);
        if (error) throw error;
        await logActivity(profile?.id, profile?.full_name, 'إضافة', 'الموظفين', null, `تم إضافة موظف جديد: ${formData.name}`, formData.branch);
      }

      setShowModal(false);
      fetchEmployees();
    } catch (err) {
      console.error('Error saving employee:', err);
      alert('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(emp) {
    if (!window.confirm(`هل أنت متأكد من حذف "${emp.name}"؟`)) return;
    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', emp.id);
      if (error) throw error;
      await logActivity(profile?.id, profile?.full_name, 'حذف', 'الموظفين', emp.id, `تم حذف الموظف: ${emp.name}`, emp.branch);
      fetchEmployees();
    } catch (err) {
      console.error('Error deleting employee:', err);
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
          <span className="title-icon" style={{ background: 'var(--info-bg)', color: 'var(--info-light)' }}>
            <Users size={28} />
          </span>
          الموظفين
        </h1>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openAddModal}>
            <Plus size={18} />
            إضافة موظف
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-info">
            <div className="stat-label">إجمالي الموظفين</div>
            <div className="stat-value">{totalEmployees}</div>
          </div>
          <div className="stat-icon primary">
            <Users size={28} />
          </div>
        </div>
        <div className="stat-card info">
          <div className="stat-info">
            <div className="stat-label">فنيين</div>
            <div className="stat-value">{technicians}</div>
          </div>
          <div className="stat-icon info">
            <Briefcase size={28} />
          </div>
        </div>
        <div className="stat-card success">
          <div className="stat-info">
            <div className="stat-label">إداريين</div>
            <div className="stat-value">{admins}</div>
          </div>
          <div className="stat-icon success">
            <Briefcase size={28} />
          </div>
        </div>
        <div className="stat-card warning">
          <div className="stat-info">
            <div className="stat-label">فرع مكة</div>
            <div className="stat-value">{meccaCount}</div>
          </div>
          <div className="stat-icon warning">
            <MapPin size={28} />
          </div>
        </div>
        <div className="stat-card danger">
          <div className="stat-info">
            <div className="stat-label">فرع جدة</div>
            <div className="stat-value">{jeddahCount}</div>
          </div>
          <div className="stat-icon danger">
            <MapPin size={28} />
          </div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="بحث بالاسم أو الهاتف..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <select
            className="form-select"
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
          >
            <option value="">كل الوظائف</option>
            {Object.entries(POSITIONS).map(([key, val]) => (
              <option key={key} value={key}>{val}</option>
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
      </div>

      <div className="table-container">
        {filteredEmployees.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h3>لا يوجد موظفين</h3>
            <p>قم بإضافة موظفين جدد لتظهر هنا</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الهاتف</th>
                <th>الوظيفة</th>
                <th>الفرع</th>
                <th>الإجازة السنوية</th>
                <th>تاريخ التعيين</th>
                <th>الحالة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map(emp => (
                <tr key={emp.id}>
                  <td>
                    <span
                      className="font-semibold clickable text-primary"
                      onClick={() => navigate(`/employees/${emp.id}`)}
                    >
                      {emp.name}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-8">
                      <Phone size={14} />
                      {emp.phone || '—'}
                    </div>
                  </td>
                  <td>
                    <span className={getPositionBadge(emp.position)}>
                      {POSITIONS[emp.position] || emp.position}
                    </span>
                  </td>
                  <td>{CITIES[emp.branch] || emp.branch}</td>
                  <td>
                    <span className="badge bg-gray-100 text-gray-800">
                      {emp.annual_leave_days || 0} يوم
                    </span>
                  </td>
                  <td>{formatDate(emp.hire_date)}</td>
                  <td>
                    <div className="flex gap-8">
                      <span className={`status-dot ${emp.status === 'inactive' ? 'inactive' : 'active'}`}></span>
                      {emp.status === 'inactive' ? 'غير نشط' : 'نشط'}
                    </div>
                  </td>
                  <td>
                    <div className="flex gap-8">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(emp)}>
                        <Edit size={16} />
                      </button>
                      <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(emp)}>
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
                {editingEmployee ? 'تعديل موظف' : 'إضافة موظف جديد'}
              </h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">الاسم *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">الهاتف</label>
                    <input
                      type="tel"
                      className="form-input"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: formatSaudiLocalPhoneInput(e.target.value) })}
                      placeholder="5xxxxxxxx"
                      inputMode="numeric"
                      maxLength={9}
                      pattern="5[0-9]{8}"
                      title="رقم سعودي: 9 أرقام ويبدأ بـ 5"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">البريد الإلكتروني</label>
                    <input
                      type="email"
                      className="form-input"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">الوظيفة *</label>
                    <select
                      className="form-select"
                      value={formData.position}
                      onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                      required
                    >
                      {Object.entries(POSITIONS).map(([key, val]) => (
                        <option key={key} value={key}>{val}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row">
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
                  <div className="form-group">
                    <label className="form-label">الراتب</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.salary}
                      onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">أيام الإجازة السنوية (بدون خصم)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.annual_leave_days}
                      onChange={(e) => setFormData({ ...formData, annual_leave_days: e.target.value })}
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">تاريخ التعيين</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.hire_date}
                      onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                    />
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
                  {saving ? 'جاري الحفظ...' : (editingEmployee ? 'تحديث' : 'إضافة')}
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

export default Employees;
