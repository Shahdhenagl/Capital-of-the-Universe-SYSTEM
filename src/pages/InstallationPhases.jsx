import { Fragment, useEffect, useState } from 'react';
import { supabase, formatCurrency, formatDate, CITIES, logActivity } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Calendar,
  CheckCircle,
  Clock,
  Filter,
  MessageCircle,
  Search,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

export default function InstallationPhases({ cityFilter = 'all' }) {
  const { profile } = useAuth();
  const [phases, setPhases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('pending');
  
  useEffect(() => {
    fetchPhases();
  }, [profile]);

  const fetchPhases = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('installation_phases')
        .select(`
          *,
          clients(name, phone),
          contracts(contract_number, total_amount),
          collection_schedule(id, amount, status, due_date)
        `)
        .order('scheduled_date', { ascending: true });

      if (profile?.role !== 'admin') {
        query = query.eq('branch', profile?.branch);
      }

      const { data, error: err } = await query;
      if (err) throw err;
      
      setPhases(data || []);
    } catch (err) {
      console.error('Error fetching phases:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkComplete = async (phase) => {
    try {
      // Check if there is an uncollected payment linked to this phase
      if (phase.collection_schedule && phase.collection_schedule.status !== 'collected') {
        alert('لا يمكن إكمال هذه المرحلة! يجب تحصيل الدفعة المرتبطة بها أولاً من شاشة التحصيلات.');
        return;
      }

      const confirmComplete = window.confirm('هل أنت متأكد من إكمال هذه المرحلة؟');
      if (!confirmComplete) return;

      const { error: err } = await supabase
        .from('installation_phases')
        .update({
          status: 'completed',
          completion_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', phase.id);

      if (err) throw err;

      await logActivity(
        profile?.id,
        profile?.full_name,
        'إكمال مرحلة تركيب',
        'installation_phases',
        phase.id,
        `إكمال المرحلة: ${phase.phase_name} للعقد ${phase.contracts?.contract_number}`,
        phase.branch
      );

      fetchPhases();
    } catch (err) {
      alert('خطأ في إكمال المرحلة: ' + err.message);
    }
  };

  const sendWhatsAppReminder = (phase) => {
    if (!phase.clients?.phone) {
      alert('رقم العميل غير متوفر.');
      return;
    }
    const amount = phase.collection_schedule ? formatCurrency(phase.collection_schedule.amount) : '';
    const phone = phase.clients.phone.startsWith('05') ? '+966' + phase.clients.phone.substring(1) : phase.clients.phone;
    const msg = `مرحباً بك عميلنا العزيز ${phase.clients.name}،\nنود تذكيركم بموعد استحقاق الدفعة الخاصة بمرحلة (${phase.phase_name}) لعقد التركيب رقم ${phase.contracts?.contract_number}.\n${amount ? `قيمة الدفعة: ${amount}\n` : ''}يرجى السداد لنتمكن من استكمال أعمال التركيب حسب الجدول الزمني.\nشاكرين لكم تعاونكم.`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <span className="badge bg-success"><CheckCircle className="w-4 h-4 ml-1 inline" /> مكتملة</span>;
      case 'in_progress':
        return <span className="badge bg-warning"><Clock className="w-4 h-4 ml-1 inline" /> جاري التنفيذ</span>;
      default:
        return <span className="badge bg-secondary"><Clock className="w-4 h-4 ml-1 inline" /> معلقة</span>;
    }
  };

  const isDelayed = (phase) => {
    if (phase.status === 'completed') return false;
    const today = new Date().toISOString().split('T')[0];
    return phase.scheduled_date < today;
  };

  const filteredPhases = phases.filter(phase => {
    const matchesSearch = 
      phase.clients?.name?.includes(searchTerm) || 
      phase.contracts?.contract_number?.includes(searchTerm) ||
      phase.phase_name?.includes(searchTerm);
    
    const matchesStatus = filterStatus === 'all' || phase.status === filterStatus;
    const matchesBranch = cityFilter === 'all' || phase.branch === cityFilter;

    return matchesSearch && matchesStatus && matchesBranch;
  });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          <span className="title-icon" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
            <Clock size={24} />
          </span>
          مراحل التركيب
        </h1>
        <div className="page-actions">
          <button onClick={fetchPhases} className="btn btn-secondary">
            <RefreshCw size={18} />
            تحديث
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-group">
          <Filter size={18} />
          
          </div>
        <div className="filter-group search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="ابحث برقم العقد، اسم العميل..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input search-input"
          />
        </div>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="loading-inline">
            <div className="loader"></div>
          </div>
        ) : error ? (
          <div className="error-message">
            <AlertCircle size={24} />
            <span>{error}</span>
          </div>
        ) : filteredPhases.length === 0 ? (
          <div className="empty-state">
            <Clock size={64} />
            <h3>لا توجد مراحل</h3>
            <p>لا توجد مراحل تركيب مطابقة للبحث.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>رقم العقد / العميل</th>
                <th>رقم المرحلة / الوصف</th>
                <th>الفرع</th>
                <th>الجدولة الزمنية</th>
                <th>حالة التحصيل</th>
                <th>حالة المرحلة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredPhases.map((phase) => {
                const delayed = isDelayed(phase);
                return (
                  <tr key={phase.id} style={{ backgroundColor: delayed ? 'var(--danger-bg)' : 'transparent' }}>
                    <td>
                      <div className="font-bold">{phase.contracts?.contract_number}</div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{phase.clients?.name}</div>
                    </td>
                    <td>
                      <div className="font-bold">المرحلة {phase.phase_number}</div>
                      <div style={{ fontSize: '0.875rem' }}>{phase.phase_name}</div>
                    </td>
                    <td>
                      <span className="badge badge-secondary">
                        {CITIES[phase.branch]}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.875rem', color: delayed ? 'var(--danger)' : 'inherit', fontWeight: delayed ? 'bold' : 'normal' }}>
                        <Calendar size={14} style={{ display: 'inline', marginLeft: '4px' }} />
                        {formatDate(phase.scheduled_date)}
                      </div>
                      {delayed && <div style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '4px' }}>متأخرة!</div>}
                    </td>
                    <td>
                      {phase.collection_schedule ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span className="font-bold">{formatCurrency(phase.collection_schedule.amount)}</span>
                          {phase.collection_schedule.status === 'collected' ? (
                            <span className="badge badge-success">مُحصلة</span>
                          ) : (
                            <span className="badge badge-danger">غير مُحصلة</span>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>- غير مرتبطة -</span>
                      )}
                    </td>
                    <td>{getStatusBadge(phase.status)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {phase.status !== 'completed' && (
                          <button
                            onClick={() => handleMarkComplete(phase)}
                            className="btn btn-primary"
                            title="إكمال المرحلة"
                          >
                            <CheckCircle size={14} />
                            إكمال
                          </button>
                        )}
                        
                        {phase.collection_schedule && phase.collection_schedule.status !== 'collected' && (
                          <button
                            onClick={() => sendWhatsAppReminder(phase)}
                            className="btn btn-success"
                            title="تذكير واتساب"
                          >
                            <MessageCircle size={14} />
                            واتساب
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
