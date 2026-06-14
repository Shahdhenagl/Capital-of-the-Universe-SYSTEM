import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, formatCurrency, formatDate, QUOTATION_STATUS, CITIES, PAYMENT_FREQUENCIES, PAYMENT_METHODS, logActivity } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { FileText, MessageCircle, Check, X, ArrowRight, Calendar, DollarSign, Download, User, Printer } from 'lucide-react';
import PrintHeader from '../components/PrintHeader';
import PrintFooter from '../components/PrintFooter';

const QUOTATION_DETAIL_SECTIONS = [
  { key: 'project', title: 'بيانات المشروع', fields: [['project_name', 'اسم المشروع'], ['project_location', 'موقع المشروع'], ['quotation_date', 'تاريخ العرض'], ['validity_period', 'مدة صلاحية العرض']] },
  { key: 'elevator', title: 'مواصفات المصعد', fields: [['elevator_type', 'نوع المصعد'], ['brand', 'الماركة'], ['capacity', 'الحمولة'], ['speed', 'السرعة'], ['stops', 'عدد الوقفات'], ['entrances', 'عدد المداخل'], ['drive_type', 'نوع التشغيل'], ['machine_type', 'نوع الماكينة'], ['control_type', 'نوع الكنترول'], ['shaft_dimensions', 'مقاس البئر'], ['cabin_dimensions', 'مقاس الكابينة'], ['door_dimensions', 'مقاس الأبواب'], ['travel_distance', 'مسافة الرحلة']] },
  { key: 'finishes', title: 'التشطيبات', fields: [['cabin_design', 'تصميم الكابينة'], ['cabin_finish', 'تشطيب الكابينة'], ['flooring', 'الأرضية'], ['ceiling', 'السقف'], ['doors_finish', 'تشطيب الأبواب'], ['operation_panels', 'لوحات التشغيل'], ['handrail_mirror', 'الدرابزين / المرآة']] },
  { key: 'safety', title: 'السلامة والأنظمة', fields: [['ard', 'جهاز الإنقاذ التلقائي', 'checkbox'], ['door_sensor', 'حساس الباب', 'checkbox'], ['overload_sensor', 'حساس زيادة الوزن', 'checkbox'], ['speed_governor', 'حاكم السرعة', 'checkbox'], ['intercom', 'الإنتركم', 'checkbox'], ['emergency_light', 'إنارة الطوارئ', 'checkbox'], ['fire_mode', 'وضع الحريق', 'checkbox']] },
  { key: 'execution', title: 'التنفيذ والضمان', fields: [['supply_duration', 'مدة التوريد'], ['installation_duration', 'مدة التركيب'], ['warranty', 'الضمان'], ['maintenance_included', 'الصيانة المشمولة'], ['excluded_items', 'الأعمال غير المشمولة']] },
  { key: 'financial', title: 'الشروط المالية', fields: [['price_before_vat', 'السعر قبل الضريبة'], ['vat_amount', 'ضريبة القيمة المضافة'], ['payment_terms', 'شروط الدفع'], ['bank_details', 'بيانات التحويل']] }
];

function emptyQuotationDetails() {
  return QUOTATION_DETAIL_SECTIONS.reduce((acc, section) => {
    acc[section.key] = {};
    return acc;
  }, {});
}

function parseQuotationDescription(description) {
  if (!description) return { plainDescription: '', details: emptyQuotationDetails() };
  try {
    const parsed = JSON.parse(description);
    return {
      plainDescription: parsed.plainDescription || '',
      details: { ...emptyQuotationDetails(), ...(parsed.details || {}) }
    };
  } catch {
    return { plainDescription: description, details: emptyQuotationDetails() };
  }
}

function hasDetailValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function isEnabledDetailValue(value) {
  return value === true || value === 'مشمول';
}

function formatDetailValue(value) {
  if (typeof value === 'boolean' || value === 'مشمول') {
    return isEnabledDetailValue(value) ? '✓' : '✕';
  }
  return value;
}

function getQuotationDetailRows(quotation) {
  const parsed = parseQuotationDescription(quotation?.description);
  return QUOTATION_DETAIL_SECTIONS.flatMap(section =>
    section.fields
      .map(([field, label]) => ({ section: section.title, label, value: parsed.details?.[section.key]?.[field] }))
      .filter(row => hasDetailValue(row.value))
  );
}

function parseQuotationNotes(notes) {
  if (!notes) return {};
  try {
    return JSON.parse(notes);
  } catch {
    return { plainNotes: notes };
  }
}

function QuotationDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [quotation, setQuotation] = useState(null);
  const [client, setClient] = useState(null);
  const [contract, setContract] = useState(null);
  const [collectionSchedule, setCollectionSchedule] = useState([]);
  const [loading, setLoading] = useState(true);

  // Accept → create contract modal
  const [showContractModal, setShowContractModal] = useState(false);
  const [savingContract, setSavingContract] = useState(false);
  const [contractForm, setContractForm] = useState({
    total_amount: '',
    payment_frequency: 'monthly',
    payment_method: 'cash',
    start_date: '',
    end_date: '',
    note: ''
  });

  // Reject modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [savingReject, setSavingReject] = useState(false);

  // PDF Printing state
  const [printItem, setPrintItem] = useState(null);

  useEffect(() => {
    fetchQuotation();
  }, [id]);

  async function fetchQuotation() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('quotations')
        .select('*, clients(id, name, phone, email, city, address)')
        .eq('id', id)
        .single();

      if (error) throw error;
      setQuotation(data);
      setClient(data.clients);

      // If accepted, fetch contract and schedule
      if (data.status === 'accepted') {
        await fetchContract(data.id, data.client_id);
      }
    } catch (err) {
      console.error('خطأ في جلب عرض السعر:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchContract(quotationId, clientId) {
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('quotation_id', quotationId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setContract(data);
        // Fetch collection schedule
        const { data: schedData, error: schedError } = await supabase
          .from('collection_schedule')
          .select('*')
          .eq('contract_id', data.id)
          .order('due_date', { ascending: true });

        if (schedError) throw schedError;
        setCollectionSchedule(schedData || []);
      }
    } catch (err) {
      console.error('خطأ في جلب العقد:', err);
    }
  }

  function handleContractFormChange(field, value) {
    setContractForm(prev => ({ ...prev, [field]: value }));
  }

  function generateCollectionDates(startDate, endDate, frequency) {
    const dates = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);

    if (frequency === 'one_time') {
      dates.push(new Date(start));
      return dates;
    }

    const monthIncrement = {
      monthly: 1,
      quarterly: 3,
      semi_annual: 6,
      annual: 12
    };

    const increment = monthIncrement[frequency] || 1;

    while (current <= end) {
      dates.push(new Date(current));
      current.setMonth(current.getMonth() + increment);
    }

    return dates;
  }

  async function handleAccept(e) {
    e.preventDefault();
    if (!contractForm.total_amount || !contractForm.start_date || !contractForm.end_date) return;

    try {
      setSavingContract(true);

      // Update quotation status and save manager response note
      const parsedQuotation = parseQuotationDescription(quotation.description);
      const quotationDetails = parsedQuotation.details || {};
      const updatedNotes = parseQuotationNotes(quotation.notes);
      if (contractForm.note) {
        updatedNotes.manager_response = {
          status: 'manager_approved',
          note: contractForm.note,
          by: profile?.full_name || profile?.email || '',
          date: new Date().toISOString()
        };
      }

      const { error: quotError } = await supabase
        .from('quotations')
        .update({ 
          status: 'accepted',
          notes: Object.keys(updatedNotes).length ? JSON.stringify(updatedNotes) : quotation.notes
        })
        .eq('id', id);

      if (quotError) throw quotError;

      // Create contract
      const contractNumber = `CT-${Date.now().toString().slice(-8)}`;
      const contractNotes = JSON.stringify({
        plainNotes: parsedQuotation.plainDescription || '',
        details: {
          contract_type: 'supply_installation',
          links: {
            client_site_id: quotationDetails.links?.client_site_id || null
          },
          contract: {
            project_name: quotationDetails.project?.project_name || quotation.title || '',
            project_location: quotationDetails.project?.project_location || ''
          },
          elevator: {
            elevator_type: quotationDetails.elevator?.elevator_type || ''
          }
        },
        attachments: []
      });
      const { data: contractData, error: contractError } = await supabase
        .from('contracts')
        .insert({
          contract_number: contractNumber,
          client_id: quotation.client_id,
          quotation_id: id,
          service_type: quotation.service_type || quotation.title || 'عرض سعر',
          title: quotation.title || quotation.service_type || 'عقد من عرض سعر',
          total_amount: parseFloat(contractForm.total_amount),
          payment_frequency: contractForm.payment_frequency,
          payment_method: contractForm.payment_method,
          start_date: contractForm.start_date,
          end_date: contractForm.end_date,
          status: 'active',
          branch: quotation.branch,
          notes: contractNotes,
          created_by: profile?.id
        })
        .select()
        .single();

      if (contractError) throw contractError;

      // Generate collection schedule
      const collectionDates = generateCollectionDates(
        contractForm.start_date,
        contractForm.end_date,
        contractForm.payment_frequency
      );

      const totalAmount = parseFloat(contractForm.total_amount);
      const installmentAmount = collectionDates.length > 0 ? totalAmount / collectionDates.length : totalAmount;

      const scheduleRows = collectionDates.map(date => ({
        contract_id: contractData.id,
        client_id: quotation.client_id,
        due_date: date.toISOString().split('T')[0],
        amount: Math.round(installmentAmount * 100) / 100,
        status: 'pending',
        branch: quotation.branch
      }));

      if (scheduleRows.length > 0) {
        const { error: schedError } = await supabase
          .from('collection_schedule')
          .insert(scheduleRows);
        if (schedError) throw schedError;
      }

      await logActivity(
        profile?.id,
        profile?.full_name,
        'قبول عرض سعر وإنشاء عقد',
        'quotations',
        id,
        `تم قبول العرض "${quotation.title}" وإنشاء العقد ${contractNumber}`,
        profile?.branch
      );

      setShowContractModal(false);
      fetchQuotation();
    } catch (err) {
      console.error('خطأ في قبول العرض:', err);
      alert(`حدث خطأ أثناء قبول عرض السعر: ${err.message || 'خطأ غير معروف'}`);
    } finally {
      setSavingContract(false);
    }
  }

  async function handleReject(e) {
    e.preventDefault();

    try {
      setSavingReject(true);

      const updatedNotes = parseQuotationNotes(quotation.notes);
      if (rejectReason) {
        updatedNotes.manager_rejection = {
          status: 'manager_rejected',
          note: rejectReason,
          by: profile?.full_name || profile?.email || '',
          date: new Date().toISOString()
        };
      }

      const { error } = await supabase
        .from('quotations')
        .update({
          status: 'rejected',
          rejection_reason: rejectReason || null,
          notes: Object.keys(updatedNotes).length ? JSON.stringify(updatedNotes) : quotation.notes
        })
        .eq('id', id);

      if (error) throw error;

      await logActivity(
        profile?.id,
        profile?.full_name,
        'رفض عرض سعر',
        'quotations',
        id,
        `تم رفض العرض "${quotation.title}"${rejectReason ? ` - السبب: ${rejectReason}` : ''}`,
        profile?.branch
      );

      setShowRejectModal(false);
      setRejectReason('');
      fetchQuotation();
    } catch (err) {
      console.error('خطأ في رفض العرض:', err);
      alert('حدث خطأ أثناء رفض عرض السعر');
    } finally {
      setSavingReject(false);
    }
  }

  function triggerPrint() {
    setPrintItem(quotation);
    setTimeout(() => {
      window.print();
      setPrintItem(null);
    }, 500);
  }

  function sendWhatsApp() {
    if (!client?.phone) return;
    const phone = client.phone.replace(/^0/, '966');
    const parsedDescription = parseQuotationDescription(quotation.description);
    const publicLink = `${window.location.origin}/q/${quotation.id}`;
    const message = encodeURIComponent(
      `مرحباً ${client.name}،\n` +
      `نود إبلاغكم بعرض السعر التالي من شركة عاصمة الكون:\n\n` +
      `📋 العنوان: ${quotation.title || ''}\n` +
      `💰 المبلغ: ${formatCurrency(quotation.amount)}\n` +
      `📅 التاريخ: ${formatDate(quotation.created_at)}\n` +
      `${parsedDescription.plainDescription ? `📝 الوصف: ${parsedDescription.plainDescription}\n` : ''}` +
      `\nيمكنكم فتح عرض السعر والرد بالموافقة أو الرفض أو التفاوض من الرابط التالي:\n${publicLink}\n` +
      `\nنتطلع لتعاونكم معنا.\nشكراً لكم.`
    );
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  }

  function getStatusBadgeClass(status) {
    const map = {
      pending: 'badge-warning',
      accepted: 'badge-success',
      rejected: 'badge-danger',
      collected: 'badge-success',
      overdue: 'badge-danger',
      partial: 'badge-warning'
    };
    return map[status] || 'badge-secondary';
  }

  function getStatusText(status) {
    const map = {
      pending: 'معلق',
      accepted: 'مقبول',
      rejected: 'مرفوض',
      collected: 'محصل',
      overdue: 'متأخر',
      partial: 'جزئي'
    };
    return map[status] || status;
  }

  if (loading) {
    return (
      <div className="loading-inline">
        <div className="loader"></div>
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="empty-state">
        <h3>عرض السعر غير موجود</h3>
        <button className="btn btn-primary mt-16" onClick={() => navigate('/quotations')}>
          <ArrowRight size={18} />
          العودة لعروض الأسعار
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Back Button */}
      <button className="btn btn-ghost mb-24" onClick={() => navigate('/quotations')}>
        <ArrowRight size={18} />
        العودة لعروض الأسعار
      </button>

      {/* Quotation Card */}
      <div className="card mb-24">
        <div className="card-header">
          <div className="flex gap-12">
            <FileText size={24} className="text-primary" />
            <div>
              <h2 className="font-bold">{quotation.title || 'عرض سعر'}</h2>
              <div className="flex align-center gap-8">
                <span className="text-muted">{quotation.quotation_number || quotation.id?.slice(0, 8)}</span>
                {quotationDetails.project_category && (
                  <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>
                    {quotationDetails.project_category}
                  </span>
                )}
              </div>
            </div>
          </div>
          <span className={`badge ${getStatusBadgeClass(quotation.status)}`} style={{ fontSize: '0.9rem', padding: '8px 20px' }}>
            {QUOTATION_STATUS[quotation.status] || quotation.status}
          </span>
        </div>
        <div className="card-body">
          {/* Client Info */}
          {client && (
            <div className="card mb-24">
              <div className="card-body">
                <h3 className="font-semibold mb-16 flex gap-8">
                  <User size={20} />
                  معلومات العميل
                </h3>
                <div className="grid-2">
                  <div className="flex gap-8">
                    <User size={16} className="text-muted" />
                    <span>{client.name}</span>
                  </div>
                  {client.phone && (
                    <div className="flex gap-8">
                      <span className="text-muted">الهاتف:</span>
                      <span>{client.phone}</span>
                    </div>
                  )}
                  {client.email && (
                    <div className="flex gap-8">
                      <span className="text-muted">البريد:</span>
                      <span>{client.email}</span>
                    </div>
                  )}
                  {client.city && (
                    <div className="flex gap-8">
                      <span className="text-muted">المدينة:</span>
                      <span>{CITIES[client.city] || client.city}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Amount */}
          <div className="stats-grid">
            <div className="stat-card primary">
              <div className="stat-info">
                <div className="stat-label">المبلغ الإجمالي</div>
                <div className="stat-value">{formatCurrency(quotation.amount)}</div>
              </div>
              <div className="stat-icon primary">
                <DollarSign size={28} />
              </div>
            </div>
            <div className="stat-card info">
              <div className="stat-info">
                <div className="stat-label">تاريخ الإنشاء</div>
                <div className="stat-value" style={{ fontSize: '1.2rem' }}>{formatDate(quotation.created_at)}</div>
              </div>
              <div className="stat-icon info">
                <Calendar size={28} />
              </div>
            </div>
            {quotation.branch && (
              <div className="stat-card success">
                <div className="stat-info">
                  <div className="stat-label">الفرع</div>
                  <div className="stat-value" style={{ fontSize: '1.2rem' }}>{CITIES[quotation.branch] || quotation.branch}</div>
                </div>
                <div className="stat-icon success">
                  <FileText size={28} />
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          {(getQuotationDetailRows(quotation).length > 0 || parseQuotationDescription(quotation.description).plainDescription) && (
            <div className="card mb-24">
              <div className="card-body">
                <h3 className="font-semibold mb-16">تفاصيل ومواصفات عرض السعر</h3>
                {getQuotationDetailRows(quotation).length > 0 && (
                  <div className="table-container mb-24">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>القسم</th>
                          <th>البند</th>
                          <th>البيان</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getQuotationDetailRows(quotation).map((row, index) => (
                          <tr key={`${row.section}-${row.label}-${index}`}>
                            <td>{row.section}</td>
                            <td>{row.label}</td>
                            <td><strong>{formatDetailValue(row.value)}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {parseQuotationDescription(quotation.description).plainDescription && (
                  <p className="text-muted">{parseQuotationDescription(quotation.description).plainDescription}</p>
                )}
              </div>
            </div>
          )}

          {/* PDF Download */}
          {quotation.pdf_url && (
            <div className="mb-24">
              <a
                href={quotation.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
              >
                <Download size={18} />
                تحميل ملف العرض (PDF)
              </a>
            </div>
          )}

          {/* Rejection Reason */}
          {quotation.status === 'rejected' && quotation.rejection_reason && (
            <div className="card mb-24 invoice-no-print">
              <div className="card-body">
                <h3 className="font-semibold mb-16 text-danger">سبب الرفض</h3>
                <p className="text-muted">{quotation.rejection_reason}</p>
              </div>
            </div>
          )}

          {/* Manager Response */}
          {(parseQuotationNotes(quotation.notes).manager_response || parseQuotationNotes(quotation.notes).manager_rejection) && (
            <div className="card mb-24 invoice-no-print">
              <div className="card-header">
                <h3 className="card-title">رد المدير</h3>
              </div>
              <div className="card-body">
                {parseQuotationNotes(quotation.notes).manager_response && (() => {
                  const response = parseQuotationNotes(quotation.notes).manager_response;
                  return (
                    <div className="form-row-3">
                      <div>
                        <span className="form-label">الحالة</span>
                        <p className="font-bold text-success">موافق ✓</p>
                      </div>
                      <div>
                        <span className="form-label">التاريخ</span>
                        <p className="font-bold">{formatDate(response.date) || '-'}</p>
                      </div>
                      <div>
                        <span className="form-label">الموظف</span>
                        <p className="font-bold">{response.by || response.user || '-'}</p>
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <span className="form-label">الملاحظات</span>
                        <p className="text-muted">{response.note || '-'}</p>
                      </div>
                    </div>
                  );
                })()}
                {parseQuotationNotes(quotation.notes).manager_rejection && (() => {
                  const rejection = parseQuotationNotes(quotation.notes).manager_rejection;
                  return (
                    <div className="form-row-3">
                      <div>
                        <span className="form-label">الحالة</span>
                        <p className="font-bold text-danger">مرفوض ✕</p>
                      </div>
                      <div>
                        <span className="form-label">التاريخ</span>
                        <p className="font-bold">{formatDate(rejection.date) || '-'}</p>
                      </div>
                      <div>
                        <span className="form-label">الموظف</span>
                        <p className="font-bold">{rejection.by || rejection.user || '-'}</p>
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <span className="form-label">السبب</span>
                        <p className="text-muted">{rejection.note || '-'}</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {parseQuotationNotes(quotation.notes).client_response && (
            <div className="card mb-24 invoice-no-print">
              <div className="card-header">
                <h3 className="card-title">رد العميل من رابط العرض</h3>
              </div>
              <div className="card-body">
                {(() => {
                  const response = parseQuotationNotes(quotation.notes).client_response;
                  return (
                    <div className="form-row-3">
                      <div>
                        <span className="form-label">قرار العميل</span>
                        <p className="font-bold">
                          {response.decision === 'accepted' ? 'موافق' : response.decision === 'rejected' ? 'رافض' : 'تفاوض'}
                        </p>
                      </div>
                      <div>
                        <span className="form-label">السعر المقترح</span>
                        <p className="font-bold">{response.negotiated_amount ? formatCurrency(response.negotiated_amount) : '-'}</p>
                      </div>
                      <div>
                        <span className="form-label">تاريخ الرد</span>
                        <p className="font-bold">{formatDate(response.responded_at)}</p>
                      </div>
                      <div>
                        <span className="form-label">اسم العميل</span>
                        <p className="font-bold">{response.customer_name || '-'}</p>
                      </div>
                      <div>
                        <span className="form-label">رقم التواصل</span>
                        <p className="font-bold">{response.customer_phone || '-'}</p>
                      </div>
                      <div>
                        <span className="form-label">ملاحظات</span>
                        <p className="font-bold">{response.notes || '-'}</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-12 mt-24">
            <button className="btn btn-whatsapp" onClick={sendWhatsApp}>
              <MessageCircle size={18} />
              إرسال عبر واتساب
            </button>

            <button className="btn btn-secondary" onClick={triggerPrint}>
              <Printer size={18} />
              طباعة العرض (PDF)
            </button>

            {quotation.status === 'pending' && (
              <>
                <button
                  className="btn btn-success"
                  onClick={() => {
                    setContractForm({
                      total_amount: quotation.amount || '',
                      payment_frequency: 'monthly',
                      payment_method: 'cash',
                      start_date: new Date().toISOString().split('T')[0],
                      end_date: ''
                    });
                    setShowContractModal(true);
                  }}
                >
                  <Check size={18} />
                  قبول العرض
                </button>
                <button className="btn btn-danger" onClick={() => setShowRejectModal(true)}>
                  <X size={18} />
                  رفض العرض
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Contract Details (if accepted) */}
      {quotation.status === 'accepted' && contract && (
        <div className="card mb-24">
          <div className="card-header">
            <h3 className="card-title">
              <FileText size={20} />
              تفاصيل العقد
            </h3>
            <span className="badge badge-success">نشط</span>
          </div>
          <div className="card-body">
            <div className="grid-3 mb-24">
              <div>
                <span className="text-muted">رقم العقد</span>
                <p className="font-bold">{contract.contract_number}</p>
              </div>
              <div>
                <span className="text-muted">القيمة الإجمالية</span>
                <p className="font-bold">{formatCurrency(contract.total_amount)}</p>
              </div>
              <div>
                <span className="text-muted">دورية الدفع</span>
                <p className="font-bold">{PAYMENT_FREQUENCIES[contract.payment_frequency] || contract.payment_frequency}</p>
              </div>
              <div>
                <span className="text-muted">طريقة الدفع</span>
                <p className="font-bold">{PAYMENT_METHODS[contract.payment_method] || contract.payment_method}</p>
              </div>
              <div>
                <span className="text-muted">تاريخ البداية</span>
                <p className="font-bold">{formatDate(contract.start_date)}</p>
              </div>
              <div>
                <span className="text-muted">تاريخ النهاية</span>
                <p className="font-bold">{formatDate(contract.end_date)}</p>
              </div>
            </div>

            {/* Collection Schedule */}
            {collectionSchedule.length > 0 && (
              <>
                <h3 className="font-semibold mb-16">جدول التحصيل ({collectionSchedule.length} دفعة)</h3>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>تاريخ الاستحقاق</th>
                        <th>المبلغ</th>
                        <th>الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {collectionSchedule.map((item, idx) => (
                        <tr key={item.id}>
                          <td>{idx + 1}</td>
                          <td>
                            <span className="flex gap-8">
                              <Calendar size={16} className="text-muted" />
                              {formatDate(item.due_date)}
                            </span>
                          </td>
                          <td>{formatCurrency(item.amount)}</td>
                          <td>
                            <span className={`badge ${getStatusBadgeClass(item.status)}`}>
                              {getStatusText(item.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Accept → Create Contract Modal */}
      {showContractModal && (
        <div className="modal-overlay" onClick={() => setShowContractModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">قبول العرض وإنشاء عقد</h2>
              <button className="modal-close" onClick={() => setShowContractModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAccept}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">قيمة العقد (ر.س) *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={contractForm.total_amount}
                    onChange={(e) => handleContractFormChange('total_amount', e.target.value)}
                    step="0.01"
                    min="0"
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">دورية الدفع *</label>
                    <select
                      className="form-select"
                      value={contractForm.payment_frequency}
                      onChange={(e) => handleContractFormChange('payment_frequency', e.target.value)}
                    >
                      {Object.entries(PAYMENT_FREQUENCIES).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">طريقة الدفع *</label>
                    <select
                      className="form-select"
                      value={contractForm.payment_method}
                      onChange={(e) => handleContractFormChange('payment_method', e.target.value)}
                    >
                      {Object.entries(PAYMENT_METHODS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">تاريخ البداية *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={contractForm.start_date}
                      onChange={(e) => handleContractFormChange('start_date', e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">تاريخ النهاية *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={contractForm.end_date}
                      onChange={(e) => handleContractFormChange('end_date', e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">ملاحظات الإدارة (تظهر داخلياً فقط)</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="اكتب ملاحظة للمندوب أو للإدارة..."
                    value={contractForm.note || ''}
                    onChange={(e) => handleContractFormChange('note', e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="submit" className="btn btn-success" disabled={savingContract}>
                  <Check size={18} />
                  {savingContract ? 'جاري الإنشاء...' : 'قبول وإنشاء العقد'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowContractModal(false)}>
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">رفض عرض السعر</h2>
              <button className="modal-close" onClick={() => setShowRejectModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleReject}>
              <div className="modal-body">
                <p className="text-muted mb-24">
                  هل أنت متأكد من رفض عرض السعر "<strong>{quotation.title}</strong>"؟
                </p>
                <div className="form-group">
                  <label className="form-label">سبب الرفض (اختياري)</label>
                  <textarea
                    className="form-textarea"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="أدخل سبب الرفض..."
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="submit" className="btn btn-danger" disabled={savingReject}>
                  <X size={18} />
                  {savingReject ? 'جاري الرفض...' : 'تأكيد الرفض'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print PDF Vector Document Section for Quotations */}
      {printItem && (
        <div className="print-only-container">
          <PrintHeader />

          <div style={{ textAlign: 'left', direction: 'ltr', marginBottom: '20px' }}>
            <p>رقم العرض: <strong>{printItem.quotation_number || printItem.id?.slice(0, 8)}</strong></p>
            <p>تاريخ العرض: {formatDate(printItem.created_at)}</p>
          </div>

          <div className="print-title">عرض سعر رسمي لتوريد وتركيب وصيانة المصاعد</div>

          <div className="print-meta-grid">
            <div className="print-meta-item">
              <span>اسم العميل الطرف الثاني</span>
              <strong>{printItem.clients?.name || '-'}</strong>
            </div>
            <div className="print-meta-item">
              <span>رقم الهاتف</span>
              <strong>{printItem.clients?.phone || '-'}</strong>
            </div>
            <div className="print-meta-item">
              <span>عنوان العرض</span>
              <strong>{printItem.title || '-'}</strong>
            </div>
            <div className="print-meta-item">
              <span>فرع المعاملة</span>
              <strong>{CITIES[printItem.branch] || printItem.branch || '-'}</strong>
            </div>
          </div>

          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '15px', color: '#1e3a8a', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px' }}>
            تفاصيل ومواصفات العرض الفني والمالي
          </h3>

          {getQuotationDetailRows(printItem).length > 0 && (
            <table className="print-table" style={{ marginBottom: '30px' }}>
              <thead>
                <tr>
                  <th>القسم</th>
                  <th>البند</th>
                  <th>البيان</th>
                </tr>
              </thead>
              <tbody>
                {getQuotationDetailRows(printItem).map((row, index) => (
                  <tr key={`${row.section}-${row.label}-${index}`}>
                    <td>{row.section}</td>
                    <td>{row.label}</td>
                    <td><strong>{formatDetailValue(row.value)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {parseQuotationDescription(printItem.description).plainDescription && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '20px', borderRadius: '8px', marginBottom: '30px' }}>
              <span style={{ fontSize: '0.85rem', color: '#64748b', display: 'block', marginBottom: '10px' }}>ملاحظات إضافية:</span>
              <p style={{ margin: 0, color: '#334155', whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>{parseQuotationDescription(printItem.description).plainDescription}</p>
            </div>
          )}

          <table className="print-table" style={{ marginTop: '20px' }}>
            <thead>
              <tr>
                <th>البند</th>
                <th>بيان التكلفة</th>
                <th>الإجمالي شامل ضريبة القيمة المضافة (ر.س)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td>{printItem.title}</td>
                <td><strong>{formatCurrency(printItem.amount)}</strong></td>
              </tr>
              <tr style={{ background: '#f1f5f9' }}>
                <td colSpan={2} style={{ textAlign: 'left', fontWeight: 'bold' }}>المجموع الكلي:</td>
                <td><strong>{formatCurrency(printItem.amount)}</strong></td>
              </tr>
            </tbody>
          </table>

          {printItem.notes && (
            <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '15px', borderRadius: '8px', marginBottom: '30px' }}>
              <span style={{ fontSize: '0.85rem', color: '#b45309', display: 'block', marginBottom: '5px' }}>ملاحظات العرض الاستثنائية:</span>
              <p style={{ margin: 0, color: '#78350f' }}>{printItem.notes}</p>
            </div>
          )}

          <div className="print-footer" style={{ marginTop: '40px' }}>
            <div className="print-signature">
              <span>المدير الفني للمصاعد</span>
              <strong>الاعتماد والختم الرسمي</strong>
            </div>
            <div className="print-signature">
              <span>الاعتماد والقبول (العميل)</span>
              <strong>التوقيع والختم</strong>
            </div>
          </div>

          <PrintFooter />
        </div>
      )}
    </div>
  );
}

export default QuotationDetails;
