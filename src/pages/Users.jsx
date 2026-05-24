import { useState, useEffect } from 'react';
import { supabase, ROLES, CITIES, logActivity } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Plus, Search, Edit, X, UserCheck } from 'lucide-react';

function UsersPage() {
  const { profile, createUser, isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'viewer',
    branch: 'all'
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = users.filter(user => {
    if (!searchTerm) return true;
    return (
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  function getRoleBadge(role) {
    const badges = {
      admin: 'badge badge-danger',
      accountant: 'badge badge-primary',
      viewer: 'badge badge-secondary'
    };
    return badges[role] || 'badge badge-secondary';
  }

  function openAddModal() {
    setEditingUser(null);
    setFormData({
      full_name: '',
      email: '',
      password: '',
      role: 'viewer',
      branch: 'all'
    });
    setShowModal(true);
  }

  function openEditModal(user) {
    setEditingUser(user);
    setFormData({
      full_name: user.full_name || '',
      email: user.email || '',
      password: '',
      role: user.role || 'viewer',
      branch: user.branch || 'all'
    });
    setShowModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingUser) {
        const updateData = {
          full_name: formData.full_name,
          role: formData.role,
          branch: formData.branch
        };

        const { error } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', editingUser.id);

        if (error) throw error;
        await logActivity(profile?.id, profile?.full_name, 'تعديل', 'المستخدمين', editingUser.id, `تم تعديل بيانات المستخدم: ${formData.full_name}`, formData.branch);
      } else {
        if (!formData.password) {
          alert('يرجى إدخال كلمة المرور');
          setSaving(false);
          return;
        }

        const { user: newUser } = await createUser(formData.email, formData.password, {
          full_name: formData.full_name,
          role: formData.role,
          branch: formData.branch
        });

        if (newUser) {
          await supabase.from('profiles').upsert({
            id: newUser.id,
            full_name: formData.full_name,
            email: formData.email,
            role: formData.role,
            branch: formData.branch
          });
        }

        await logActivity(profile?.id, profile?.full_name, 'إضافة', 'المستخدمين', null, `تم إضافة مستخدم جديد: ${formData.full_name} (${ROLES[formData.role]})`, formData.branch);
      }

      setShowModal(false);
      fetchUsers();
    } catch (err) {
      console.error('Error saving user:', err);
      alert(err.message || 'حدث خطأ أثناء الحفظ');
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
          <span className="title-icon" style={{ background: 'var(--danger-bg)', color: 'var(--danger-light)' }}>
            <Shield size={28} />
          </span>
          المستخدمين
        </h1>
        <div className="page-actions">
          {isAdmin && (
            <button className="btn btn-primary" onClick={openAddModal}>
              <Plus size={18} />
              إضافة مستخدم
            </button>
          )}
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="بحث بالاسم أو البريد..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="table-container">
        {filteredUsers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔐</div>
            <h3>لا يوجد مستخدمين</h3>
            <p>قم بإضافة مستخدمين جدد للنظام</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>البريد</th>
                <th>الدور</th>
                <th>الفرع</th>
                <th>الحالة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => (
                <tr key={user.id}>
                  <td>
                    <div className="flex gap-8">
                      <UserCheck size={16} />
                      <span className="font-semibold">{user.full_name}</span>
                    </div>
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <span className={getRoleBadge(user.role)}>
                      {ROLES[user.role] || user.role}
                    </span>
                  </td>
                  <td>
                    {user.branch === 'all' ? 'جميع الفروع' : (CITIES[user.branch] || user.branch)}
                  </td>
                  <td>
                    <div className="flex gap-8">
                      <span className={`status-dot ${user.status === 'inactive' ? 'inactive' : 'active'}`}></span>
                      {user.status === 'inactive' ? 'غير نشط' : 'نشط'}
                    </div>
                  </td>
                  <td>
                    {isAdmin && (
                      <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(user)}>
                        <Edit size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingUser ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}
              </h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">الاسم الكامل *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">البريد الإلكتروني *</label>
                  <input
                    type="email"
                    className="form-input"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    disabled={!!editingUser}
                  />
                </div>
                {!editingUser && (
                  <div className="form-group">
                    <label className="form-label">كلمة المرور *</label>
                    <input
                      type="password"
                      className="form-input"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required={!editingUser}
                      minLength={6}
                    />
                    <span className="form-hint">يجب أن تكون 6 أحرف على الأقل</span>
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">الدور *</label>
                    <select
                      className="form-select"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      required
                    >
                      {Object.entries(ROLES).map(([key, val]) => (
                        <option key={key} value={key}>{val}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">الفرع *</label>
                    <select
                      className="form-select"
                      value={formData.branch}
                      onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                      required
                    >
                      <option value="all">جميع الفروع</option>
                      {Object.entries(CITIES).map(([key, val]) => (
                        <option key={key} value={key}>{val}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'جاري الحفظ...' : (editingUser ? 'تحديث' : 'إضافة')}
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

export default UsersPage;
