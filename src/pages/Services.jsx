import { useEffect, useMemo, useState } from 'react';
import { supabase, logActivity } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { BriefcaseBusiness, Edit, Plus, Search, ToggleLeft, ToggleRight, Trash2, X } from 'lucide-react';

const DEFAULT_SERVICES = [
  'صيانة مصاعد',
  'توريد وتركيب مصاعد',
  'إصلاح أعطال',
  'معاينات',
  'مقايسات',
  'قطع غيار'
];

function Services() {
  const { profile } = useAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [form, setForm] = useState({
    name: '',
    description: '',
    is_active: true
  });

  useEffect(() => {
    fetchServices();
  }, []);

  async function fetchServices() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setServices(data || []);
    } catch (err) {
      console.error('خطأ في جلب الخدمات:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredServices = useMemo(() => {
    return services.filter(service => {
      const matchesSearch = !searchTerm ||
        (service.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (service.description || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && service.is_active !== false) ||
        (statusFilter === 'inactive' && service.is_active === false);

      return matchesSearch && matchesStatus;
    });
  }, [services, searchTerm, statusFilter]);

  const activeCount = services.filter(service => service.is_active !== false).length;
  const inactiveCount = services.filter(service => service.is_active === false).length;

  function resetForm() {
    setForm({ name: '', description: '', is_active: true });
  }

  function openAddModal(name = '') {
    setEditingService(null);
    setForm({ name, description: '', is_active: true });
    setShowModal(true);
  }

  function openEditModal(service) {
    setEditingService(service);
    setForm({
      name: service.name || '',
      description: service.description || '',
      is_active: service.is_active !== false
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingService(null);
    resetForm();
  }

  async function handleSaveService(event) {
    event.preventDefault();
    if (!form.name.trim()) return;

    try {
      setSaving(true);
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        is_active: form.is_active
      };

      const { data, error } = editingService
        ? await supabase.from('services').update(payload).eq('id', editingService.id).select().single()
        : await supabase.from('services').insert(payload).select().single();

      if (error) throw error;

      await logActivity(
        profile?.id,
        profile?.full_name,
        editingService ? 'تعديل خدمة' : 'إضافة خدمة',
        'services',
        data?.id,
        `${editingService ? 'تم تعديل' : 'تم إضافة'} خدمة: ${payload.name}`,
        profile?.branch
      );

      closeModal();
      fetchServices();
    } catch (err) {
      console.error('خطأ في حفظ الخدمة:', err);
      alert(err.code === '23505' ? 'اسم الخدمة موجود بالفعل' : 'حدث خطأ أثناء حفظ الخدمة');
    } finally {
      setSaving(false);
    }
  }

  async function toggleServiceStatus(service) {
    const nextStatus = service.is_active === false;
    try {
      const { error } = await supabase
        .from('services')
        .update({ is_active: nextStatus })
        .eq('id', service.id);

      if (error) throw error;
      fetchServices();
    } catch (err) {
      console.error('خطأ في تحديث حالة الخدمة:', err);
      alert('حدث خطأ أثناء تحديث حالة الخدمة');
    }
  }

  async function handleDeleteService(service) {
    if (!window.confirm(`هل تريد حذف خدمة "${service.name}"؟`)) return;

    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', service.id);

      if (error) throw error;
      fetchServices();
    } catch (err) {
      console.error('خطأ في حذف الخدمة:', err);
      alert('تعذر حذف الخدمة لأنها قد تكون مستخدمة في عروض أسعار أو عقود. سيتم تعطيلها بدل الحذف.');
      await supabase.from('services').update({ is_active: false }).eq('id', service.id);
      fetchServices();
    }
  }

  async function seedDefaultServices() {
    try {
      setSaving(true);
      const existingNames = new Set(services.map(service => (service.name || '').trim()));
      const rows = DEFAULT_SERVICES
        .filter(name => !existingNames.has(name))
        .map(name => ({ name, is_active: true }));

      if (rows.length === 0) {
        alert('كل الخدمات الأساسية موجودة بالفعل');
        return;
      }

      const { error } = await supabase.from('services').insert(rows);
      if (error) throw error;
      fetchServices();
    } catch (err) {
      console.error('خطأ في إضافة الخدمات الأساسية:', err);
      alert('حدث خطأ أثناء إضافة الخدمات الأساسية');
    } finally {
      setSaving(false);
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
            <BriefcaseBusiness size={24} />
          </span>
          أنواع الخدمات
        </h1>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={seedDefaultServices} disabled={saving}>
            إضافة الخدمات الأساسية
          </button>
          <button className="btn btn-primary" onClick={() => openAddModal()}>
            <Plus size={18} />
            إضافة خدمة
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card success">
          <div className="stat-info">
            <div className="stat-label">خدمات نشطة</div>
            <div className="stat-value">{activeCount}</div>
          </div>
        </div>
        <div className="stat-card warning">
          <div className="stat-info">
            <div className="stat-label">خدمات معطلة</div>
            <div className="stat-value">{inactiveCount}</div>
          </div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-group search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="form-input search-input"
            placeholder="بحث باسم الخدمة..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <div className="filter-group">
          <button className={`city-filter-btn ${statusFilter === 'active' ? 'active' : ''}`} onClick={() => setStatusFilter('active')}>
            النشطة
          </button>
          <button className={`city-filter-btn ${statusFilter === 'inactive' ? 'active' : ''}`} onClick={() => setStatusFilter('inactive')}>
            المعطلة
          </button>
          <button className={`city-filter-btn ${statusFilter === 'all' ? 'active' : ''}`} onClick={() => setStatusFilter('all')}>
            الكل
          </button>
        </div>
      </div>

      {filteredServices.length === 0 ? (
        <div className="empty-state">
          <BriefcaseBusiness size={56} />
          <h3>لا توجد خدمات</h3>
          <p>أضف خدمات الشركة مثل الصيانة، التركيب، إصلاح الأعطال، المعاينات والمقايسات.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>اسم الخدمة</th>
                <th>الوصف</th>
                <th>الحالة</th>
                <th>تاريخ الإضافة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredServices.map(service => (
                <tr key={service.id}>
                  <td><strong>{service.name}</strong></td>
                  <td>{service.description || '-'}</td>
                  <td>
                    <span className={`badge ${service.is_active === false ? 'badge-secondary' : 'badge-success'}`}>
                      {service.is_active === false ? 'معطلة' : 'نشطة'}
                    </span>
                  </td>
                  <td>{service.created_at ? new Date(service.created_at).toLocaleDateString('ar-SA') : '-'}</td>
                  <td>
                    <div className="page-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(service)} title="تعديل الخدمة">
                        <Edit size={16} />
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleServiceStatus(service)} title="تفعيل / تعطيل">
                        {service.is_active === false ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
                      </button>
                      <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDeleteService(service)} title="حذف الخدمة">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingService ? 'تعديل خدمة' : 'إضافة خدمة جديدة'}</h2>
              <button className="modal-close" onClick={closeModal}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveService}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">اسم الخدمة *</label>
                  <input
                    className="form-input"
                    value={form.name}
                    onChange={(event) => setForm(prev => ({ ...prev, name: event.target.value }))}
                    placeholder="مثال: صيانة مصاعد"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">الوصف</label>
                  <textarea
                    className="form-textarea"
                    value={form.description}
                    onChange={(event) => setForm(prev => ({ ...prev, description: event.target.value }))}
                    placeholder="وصف مختصر للخدمة..."
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">الحالة</label>
                  <select
                    className="form-select"
                    value={form.is_active ? 'active' : 'inactive'}
                    onChange={(event) => setForm(prev => ({ ...prev, is_active: event.target.value === 'active' }))}
                  >
                    <option value="active">نشطة</option>
                    <option value="inactive">معطلة</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <Plus size={18} />
                  {saving ? 'جاري الحفظ...' : editingService ? 'حفظ التعديلات' : 'إضافة الخدمة'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
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

export default Services;
