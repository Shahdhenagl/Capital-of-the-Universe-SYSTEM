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

export default function InstallationPhases() {
  const { profile } = useAuth();
  const [phases, setPhases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('pending');
  const [filterBranch, setFilterBranch] = useState('all');

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
    const matchesBranch = filterBranch === 'all' || phase.branch === filterBranch;

    return matchesSearch && matchesStatus && matchesBranch;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">مراحل التركيب</h1>
          <p className="mt-1 text-sm text-gray-500">متابعة سير أعمال التركيبات والمطالبات المالية المرتبطة بها</p>
        </div>
        <button onClick={fetchPhases} className="btn btn-secondary">
          تحديث <RefreshCw className="w-4 h-4 mr-2" /> {/* Assuming RefreshCw import, wait I didn't import it, let's just use text */}
        </button>
      </div>

      <div className="card">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="ابحث برقم العقد، اسم العميل، المرحلة..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pr-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input"
            >
              <option value="all">جميع الحالات</option>
              <option value="pending">معلقة</option>
              <option value="in_progress">جاري التنفيذ</option>
              <option value="completed">مكتملة</option>
            </select>
          </div>
          {profile?.role === 'admin' && (
            <select
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              className="input md:w-48"
            >
              <option value="all">جميع الفروع</option>
              {Object.entries(CITIES).map(([key, value]) => (
                <option key={key} value={key}>{value}</option>
              ))}
            </select>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-r-transparent"></div>
            <p className="mt-2 text-gray-500">جاري تحميل المراحل...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-600">
            <AlertCircle className="w-12 h-12 mx-auto mb-3" />
            <p>{error}</p>
          </div>
        ) : filteredPhases.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>لا توجد مراحل تركيب مطابقة للبحث</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
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
                    <tr key={phase.id} className={delayed ? 'bg-red-50' : ''}>
                      <td>
                        <div className="font-bold">{phase.contracts?.contract_number}</div>
                        <div className="text-sm text-gray-500">{phase.clients?.name}</div>
                      </td>
                      <td>
                        <div className="font-bold">المرحلة {phase.phase_number}</div>
                        <div className="text-sm">{phase.phase_name}</div>
                      </td>
                      <td>
                        <span className="badge bg-gray-100 text-gray-800">
                          {CITIES[phase.branch]}
                        </span>
                      </td>
                      <td>
                        <div className={`text-sm ${delayed ? 'text-red-600 font-bold' : ''}`}>
                          <Calendar className="w-4 h-4 inline ml-1" />
                          {formatDate(phase.scheduled_date)}
                        </div>
                        {delayed && <div className="text-xs text-red-500 mt-1">متأخرة!</div>}
                      </td>
                      <td>
                        {phase.collection_schedule ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-bold">{formatCurrency(phase.collection_schedule.amount)}</span>
                            {phase.collection_schedule.status === 'collected' ? (
                              <span className="badge bg-success text-xs">مُحصلة</span>
                            ) : (
                              <span className="badge bg-danger text-xs">غير مُحصلة</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">- غير مرتبطة -</span>
                        )}
                      </td>
                      <td>{getStatusBadge(phase.status)}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          {phase.status !== 'completed' && (
                            <button
                              onClick={() => handleMarkComplete(phase)}
                              className="btn btn-primary text-sm py-1 px-3"
                              title="إكمال المرحلة"
                            >
                              إكمال
                            </button>
                          )}
                          
                          {phase.collection_schedule && phase.collection_schedule.status !== 'collected' && (
                            <button
                              onClick={() => sendWhatsAppReminder(phase)}
                              className="btn btn-secondary text-sm py-1 px-3 !bg-green-100 !text-green-700 hover:!bg-green-200 border-none flex items-center"
                              title="تذكير واتساب"
                            >
                              <MessageCircle className="w-4 h-4 ml-1" /> واتساب
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
