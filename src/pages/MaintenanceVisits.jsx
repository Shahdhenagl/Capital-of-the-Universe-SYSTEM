import { useState, useEffect } from 'react';
import { supabase, CITIES, formatCurrency, formatDate, logActivity } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, CheckCircle, Clock, Upload, Filter, AlertCircle, FileText, Check, FileUp, Building2, Phone, X } from 'lucide-react';

export default function MaintenanceVisits({ cityFilter = 'all' }) {
  const { profile } = useAuth();
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [completingVisit, setCompletingVisit] = useState(null);
  const [reportFile, setReportFile] = useState(null);
  const [visitNotes, setVisitNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchVisits();
  }, [cityFilter, filterStatus, filterMonth]);

  async function fetchVisits() {
    try {
      setLoading(true);
      
      let query = supabase
        .from('maintenance_visits')
        .select(`
          *,
          contracts (contract_number, title),
          clients (name, phone),
          collection_schedule (amount, status, due_date)
        `)
        .order('scheduled_date', { ascending: true });

      if (cityFilter !== 'all') {
        query = query.eq('branch', cityFilter);
      }
      
      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }
      
      if (filterMonth) {
        const startDate = `${filterMonth}-01`;
        const nextMonth = new Date(filterMonth);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        const endDate = nextMonth.toISOString().slice(0, 7) + '-01';
        
        query = query.gte('scheduled_date', startDate).lt('scheduled_date', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      setVisits(data || []);
    } catch (err) {
      console.error('Error fetching maintenance visits:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteVisit(e) {
    e.preventDefault();
    if (!completingVisit) return;
    
    setIsSubmitting(true);
    try {
      let reportUrl = null;

      if (reportFile) {
        const fileExt = reportFile.name.split('.').pop();
        const fileName = `${completingVisit.id}_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('maintenance_reports')
          .upload(fileName, reportFile);
          
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('maintenance_reports')
          .getPublicUrl(fileName);
          
        reportUrl = publicUrl;
      }

      const { error } = await supabase
        .from('maintenance_visits')
        .update({
          status: 'completed',
          visit_date: new Date().toISOString().split('T')[0],
          notes: visitNotes,
          ...(reportUrl ? { report_url: reportUrl } : {})
        })
        .eq('id', completingVisit.id);

      if (error) throw error;

      await logActivity(
        profile?.id,
        profile?.full_name,
        'إتمام زيارة صيانة',
        'maintenance',
        completingVisit.id,
        `تم إغلاق زيارة الصيانة لعقد ${completingVisit.contracts?.contract_number}`,
        completingVisit.branch
      );

      setCompletingVisit(null);
      setReportFile(null);
      setVisitNotes('');
      fetchVisits();
    } catch (err) {
      console.error('Error completing visit:', err);
      alert('حدث خطأ أثناء حفظ الزيارة: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function markCollectionPaid(collectionId, visitId) {
    if (!window.confirm('هل أنت متأكد من تأكيد استلام هذا التحصيل؟ سيتم إغلاقه في النظام كـ محصل.')) return;
    
    try {
      const { error } = await supabase
        .from('collection_schedule')
        .update({ status: 'collected', payment_date: new Date().toISOString().split('T')[0] })
        .eq('id', collectionId);

      if (error) throw error;
      
      await logActivity(
        profile?.id,
        profile?.full_name,
        'تحصيل مستحقات',
        'maintenance',
        visitId,
        `تم تحصيل مبالغ تابعة لزيارة الصيانة المجدولة`,
        cityFilter
      );
      
      fetchVisits();
    } catch (err) {
      console.error('Error updating collection:', err);
      alert('حدث خطأ أثناء تأكيد التحصيل.');
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed': return <span className="badge badge-success"><CheckCircle size={14} className="mr-1" /> تمت</span>;
      case 'delayed': return <span className="badge badge-danger"><AlertCircle size={14} className="mr-1" /> متأخرة</span>;
      default: return <span className="badge badge-warning"><Clock size={14} className="mr-1" /> مجدولة</span>;
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          <Calendar size={28} style={{ color: '#0f766e' }} />
          حركات الصيانة وجدولة الزيارات
        </h1>
      </div>

      <div className="filters-section" style={{ display: 'flex', gap: '15px', marginBottom: '25px', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ flex: '1', minWidth: '200px' }}>
          <label className="form-label"><Filter size={16} className="mr-1" /> حالة الزيارة</label>
          <select className="form-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">الكل</option>
            <option value="pending">مجدولة / معلقة</option>
            <option value="completed">تمت بنجاح</option>
            <option value="delayed">متأخرة</option>
          </select>
        </div>
        <div className="form-group" style={{ flex: '1', minWidth: '200px' }}>
          <label className="form-label"><Calendar size={16} className="mr-1" /> شهر الزيارة</label>
          <input 
            type="month" 
            className="form-input" 
            value={filterMonth} 
            onChange={(e) => setFilterMonth(e.target.value)} 
          />
        </div>
      </div>

      {loading ? (
        <div className="loading-inline">
          <div className="loader"></div>
        </div>
      ) : visits.length === 0 ? (
        <div className="empty-state">
          <Calendar size={48} />
          <h3>لا توجد زيارات صيانة</h3>
          <p>لم يتم العثور على أي زيارات تطابق معايير البحث المحددة.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>تاريخ الزيارة المجدول</th>
                <th>العقد / العميل</th>
                <th>الفرع</th>
                <th>الحالة</th>
                <th>التحصيلات المرتبطة</th>
                <th>التقرير</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((visit) => {
                const isOverdue = visit.status === 'pending' && new Date(visit.scheduled_date) < new Date();
                
                return (
                  <tr key={visit.id} style={{ background: isOverdue ? '#fef2f2' : 'transparent' }}>
                    <td>
                      <div style={{ fontWeight: 600, color: isOverdue ? '#ef4444' : '#0f172a' }}>
                        {formatDate(visit.scheduled_date)}
                      </div>
                      {isOverdue && <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>متأخرة عن الموعد!</span>}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{visit.contracts?.contract_number}</div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}>
                        <Building2 size={12} /> {visit.clients?.name}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                        <Phone size={12} /> {visit.clients?.phone}
                      </div>
                    </td>
                    <td>{CITIES[visit.branch] || visit.branch}</td>
                    <td>{getStatusBadge(isOverdue && visit.status === 'pending' ? 'delayed' : visit.status)}</td>
                    <td>
                      {visit.has_collection && visit.collection_schedule ? (
                        <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          <div style={{ fontWeight: 700, color: '#0f766e', fontSize: '0.9rem' }}>{formatCurrency(visit.collection_schedule.amount)}</div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '5px' }}>
                            {visit.collection_schedule.status === 'collected' ? (
                              <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>محصل</span>
                            ) : (
                              <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>بانتظار التحصيل</span>
                            )}
                            {visit.collection_schedule.status !== 'collected' && (
                              <button 
                                className="btn btn-secondary btn-sm" 
                                style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                                onClick={() => markCollectionPaid(visit.collection_id, visit.id)}
                              >
                                تأكيد التحصيل
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>لا يوجد تحصيل بهذه الزيارة</span>
                      )}
                    </td>
                    <td>
                      {visit.report_url ? (
                        <a href={visit.report_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                          <FileText size={14} className="mr-1" /> عرض التقرير
                        </a>
                      ) : '-'}
                    </td>
                    <td>
                      {visit.status !== 'completed' && (
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={() => setCompletingVisit(visit)}
                        >
                          <Check size={16} className="mr-1" /> إنهاء الزيارة
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal for Completing Visit */}
      {completingVisit && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>إتمام زيارة صيانة</h2>
              <button className="btn-close" onClick={() => setCompletingVisit(null)}><X size={24} /></button>
            </div>
            <div className="modal-body">
              <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                <p style={{ margin: '0 0 5px 0' }}>رقم العقد: <strong>{completingVisit.contracts?.contract_number}</strong></p>
                <p style={{ margin: '0 0 5px 0' }}>العميل: <strong>{completingVisit.clients?.name}</strong></p>
                <p style={{ margin: 0 }}>تاريخ الزيارة المجدول: <strong>{formatDate(completingVisit.scheduled_date)}</strong></p>
              </div>

              <form onSubmit={handleCompleteVisit}>
                <div className="form-group">
                  <label className="form-label">ملاحظات الفني / نتيجة الزيارة</label>
                  <textarea 
                    className="form-input" 
                    rows="3"
                    value={visitNotes}
                    onChange={(e) => setVisitNotes(e.target.value)}
                    placeholder="اكتب تفاصيل أو ملاحظات الصيانة هنا..."
                  ></textarea>
                </div>
                
                <div className="form-group">
                  <label className="form-label">إرفاق تقرير الفحص (اختياري)</label>
                  <div className="file-upload-wrapper">
                    <input 
                      type="file" 
                      id="reportFile" 
                      className="file-upload-input" 
                      accept="image/*,.pdf"
                      onChange={(e) => setReportFile(e.target.files[0])}
                    />
                    <label htmlFor="reportFile" className="file-upload-label" style={{ padding: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <FileUp size={24} style={{ marginBottom: '10px', color: '#64748b' }} />
                      <span className="file-upload-text">
                        {reportFile ? reportFile.name : 'اضغط لاختيار ملف التقرير أو صورة الفحص'}
                      </span>
                    </label>
                  </div>
                </div>

                <div className="form-actions" style={{ marginTop: '25px' }}>
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? 'جاري الحفظ...' : 'حفظ وإغلاق الزيارة'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setCompletingVisit(null)}>
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
