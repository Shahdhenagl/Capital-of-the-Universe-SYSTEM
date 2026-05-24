import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, formatDate, formatCurrency, CITIES, POSITIONS } from '../lib/supabase';
import { User, Phone, Mail, MapPin, Briefcase, Calendar, DollarSign, ArrowRight, Activity } from 'lucide-react';

function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployee();
  }, [id]);

  async function fetchEmployee() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setEmployee(data);

      if (data?.name) {
        const { data: logs, error: logsError } = await supabase
          .from('activity_log')
          .select('*')
          .eq('user_name', data.name)
          .order('created_at', { ascending: false })
          .limit(50);

        if (!logsError) {
          setActivities(logs || []);
        }
      }
    } catch (err) {
      console.error('Error fetching employee:', err);
    } finally {
      setLoading(false);
    }
  }

  function getInitials(name) {
    if (!name) return '؟';
    const words = name.trim().split(' ');
    if (words.length >= 2) {
      return words[0][0] + words[1][0];
    }
    return words[0][0];
  }

  function formatDateTime(date) {
    if (!date) return '';
    return new Date(date).toLocaleString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  if (loading) {
    return (
      <div className="loading-inline">
        <div className="loader"></div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="empty-state">
        <div className="empty-icon">👤</div>
        <h3>لم يتم العثور على الموظف</h3>
        <button className="btn btn-primary mt-16" onClick={() => navigate('/employees')}>
          <ArrowRight size={18} />
          العودة للموظفين
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          <span className="title-icon" style={{ background: 'var(--info-bg)', color: 'var(--info-light)' }}>
            <User size={28} />
          </span>
          ملف الموظف
        </h1>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => navigate('/employees')}>
            <ArrowRight size={18} />
            العودة للموظفين
          </button>
        </div>
      </div>

      <div className="profile-header">
        <div className="profile-avatar">
          {getInitials(employee.name)}
        </div>
        <div className="profile-info">
          <h2 className="profile-name">{employee.name}</h2>
          <div className="profile-meta">
            <div className="profile-meta-item">
              <Phone size={16} />
              {employee.phone || 'غير متوفر'}
            </div>
            <div className="profile-meta-item">
              <Mail size={16} />
              {employee.email || 'غير متوفر'}
            </div>
            <div className="profile-meta-item">
              <Briefcase size={16} />
              {POSITIONS[employee.position] || employee.position}
            </div>
            <div className="profile-meta-item">
              <MapPin size={16} />
              {CITIES[employee.branch] || employee.branch}
            </div>
            <div className="profile-meta-item">
              <Calendar size={16} />
              {formatDate(employee.hire_date) || 'غير محدد'}
            </div>
            <div className="profile-meta-item">
              <DollarSign size={16} />
              {formatCurrency(employee.salary)}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <Activity size={20} />
            سجل الأنشطة
          </h3>
        </div>
        <div className="card-body">
          {activities.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <h3>لا توجد أنشطة مسجلة</h3>
              <p>لم يتم تسجيل أي نشاط لهذا الموظف بعد</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>العملية</th>
                    <th>الموديول</th>
                    <th>التفاصيل</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map(act => (
                    <tr key={act.id}>
                      <td className="text-muted">{formatDateTime(act.created_at)}</td>
                      <td>
                        <span className="badge badge-primary">{act.action}</span>
                      </td>
                      <td>{act.module}</td>
                      <td>{act.details || '—'}</td>
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

export default EmployeeProfile;
