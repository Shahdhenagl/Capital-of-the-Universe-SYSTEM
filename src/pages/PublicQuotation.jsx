import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, FileText, MessageSquare, Printer, X } from 'lucide-react';
import { CITIES, formatCurrency, formatDate } from '../lib/supabase';

const DETAIL_SECTIONS = [
  { key: 'project', title: 'بيانات المشروع', fields: [['project_name', 'اسم المشروع'], ['project_location', 'موقع المشروع'], ['quotation_date', 'تاريخ العرض'], ['validity_period', 'مدة صلاحية العرض']] },
  { key: 'elevator', title: 'مواصفات المصعد', fields: [['elevator_type', 'نوع المصعد'], ['brand', 'الماركة'], ['capacity', 'الحمولة'], ['speed', 'السرعة'], ['stops', 'عدد الوقفات'], ['entrances', 'عدد المداخل'], ['drive_type', 'نوع التشغيل'], ['machine_type', 'نوع الماكينة'], ['control_type', 'نوع الكنترول'], ['shaft_dimensions', 'مقاس البئر'], ['cabin_dimensions', 'مقاس الكابينة'], ['door_dimensions', 'مقاس الأبواب'], ['travel_distance', 'مسافة الرحلة']] },
  { key: 'finishes', title: 'التشطيبات', fields: [['cabin_design', 'تصميم الكابينة'], ['cabin_finish', 'تشطيب الكابينة'], ['flooring', 'الأرضية'], ['ceiling', 'السقف'], ['doors_finish', 'تشطيب الأبواب'], ['operation_panels', 'لوحات التشغيل'], ['handrail_mirror', 'الدرابزين / المرآة']] },
  { key: 'safety', title: 'السلامة والأنظمة', fields: [['ard', 'جهاز الإنقاذ التلقائي'], ['door_sensor', 'حساس الباب'], ['overload_sensor', 'حساس زيادة الوزن'], ['speed_governor', 'حاكم السرعة'], ['intercom', 'الإنتركم'], ['emergency_light', 'إنارة الطوارئ'], ['fire_mode', 'وضع الحريق']] },
  { key: 'execution', title: 'التنفيذ والضمان', fields: [['supply_duration', 'مدة التوريد'], ['installation_duration', 'مدة التركيب'], ['warranty', 'الضمان'], ['maintenance_included', 'الصيانة المشمولة'], ['excluded_items', 'الأعمال غير المشمولة']] },
  { key: 'financial', title: 'الشروط المالية', fields: [['price_before_vat', 'السعر قبل الضريبة'], ['vat_amount', 'ضريبة القيمة المضافة'], ['payment_terms', 'شروط الدفع'], ['bank_details', 'بيانات التحويل']] }
];

function emptyDetails() {
  return DETAIL_SECTIONS.reduce((acc, section) => {
    acc[section.key] = {};
    return acc;
  }, {});
}

function parseDescription(description) {
  if (!description) return { plainDescription: '', details: emptyDetails() };
  try {
    const parsed = JSON.parse(description);
    return {
      plainDescription: parsed.plainDescription || '',
      details: { ...emptyDetails(), ...(parsed.details || {}) }
    };
  } catch {
    return { plainDescription: description, details: emptyDetails() };
  }
}

function detailRows(quotation) {
  const parsed = parseDescription(quotation?.description);
  return DETAIL_SECTIONS.flatMap(section =>
    section.fields
      .map(([field, label]) => ({ section: section.title, label, value: parsed.details?.[section.key]?.[field] }))
      .filter(row => row.value)
  );
}

export default function PublicQuotation() {
  const { id } = useParams();
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [responseForm, setResponseForm] = useState({
    decision: 'accepted',
    negotiated_amount: '',
    customer_name: '',
    customer_phone: '',
    notes: ''
  });

  useEffect(() => {
    fetchQuotation();
  }, [id]);

  async function fetchQuotation() {
    try {
      setLoading(true);
      const response = await fetch(`/api/public-quotation?id=${encodeURIComponent(id)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'تعذر تحميل عرض السعر');
      setQuotation(data.quotation);
    } catch (err) {
      setError(err.message || 'تعذر تحميل عرض السعر');
    } finally {
      setLoading(false);
    }
  }

  const parsedDescription = useMemo(() => parseDescription(quotation?.description), [quotation]);
  const rows = useMemo(() => detailRows(quotation), [quotation]);

  async function submitResponse(event) {
    event.preventDefault();
    try {
      setSubmitting(true);
      const response = await fetch('/api/public-quotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...responseForm })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'تعذر إرسال الرد');
      setSubmitted(true);
    } catch (err) {
      alert(err.message || 'تعذر إرسال الرد');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="empty-state" style={{ minHeight: '100vh' }}>
        <FileText size={56} />
        <h3>{error || 'عرض السعر غير موجود'}</h3>
      </div>
    );
  }

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '24px' }}>
      <div style={{ maxWidth: '980px', margin: '0 auto' }}>
        <div className="card mb-24">
          <div className="card-body">
            <div className="flex-between" style={{ alignItems: 'flex-start', gap: '16px' }}>
              <div>
                <h1 className="page-title" style={{ marginBottom: '8px' }}>عرض سعر من شركة عاصمة الكون</h1>
                <p className="text-muted">رقم العرض: {quotation.quotation_number || quotation.id?.slice(0, 8)}</p>
              </div>
              <button className="btn btn-secondary" onClick={() => window.print()}>
                <Printer size={18} />
                طباعة / حفظ PDF
              </button>
            </div>

            <div className="form-row-3 mt-24">
              <div>
                <span className="form-label">العميل</span>
                <p className="font-bold">{quotation.clients?.name || '-'}</p>
              </div>
              <div>
                <span className="form-label">تاريخ العرض</span>
                <p className="font-bold">{formatDate(quotation.created_at)}</p>
              </div>
              <div>
                <span className="form-label">الفرع</span>
                <p className="font-bold">{CITIES[quotation.branch] || quotation.branch || '-'}</p>
              </div>
            </div>

            <div className="form-row mt-24">
              <div>
                <span className="form-label">عنوان العرض</span>
                <p className="font-bold">{quotation.title || '-'}</p>
              </div>
              <div>
                <span className="form-label">إجمالي العرض</span>
                <p className="font-bold text-success" style={{ fontSize: '1.4rem' }}>{formatCurrency(quotation.amount)}</p>
              </div>
            </div>
          </div>
        </div>

        {rows.length > 0 && (
          <div className="card mb-24">
            <div className="card-header">
              <h3 className="card-title">تفاصيل ومواصفات العرض</h3>
            </div>
            <div className="card-body">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>القسم</th>
                    <th>البند</th>
                    <th>البيان</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${row.section}-${row.label}-${index}`}>
                      <td>{row.section}</td>
                      <td>{row.label}</td>
                      <td><strong>{row.value}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {parsedDescription.plainDescription && (
          <div className="card mb-24">
            <div className="card-body">
              <h3 className="font-semibold mb-16">ملاحظات إضافية</h3>
              <p className="text-muted" style={{ whiteSpace: 'pre-wrap' }}>{parsedDescription.plainDescription}</p>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <h3 className="card-title"><MessageSquare size={18} /> رد العميل على عرض السعر</h3>
          </div>
          <div className="card-body">
            {submitted ? (
              <div className="empty-state">
                <Check size={52} className="text-success" />
                <h3>تم إرسال ردك بنجاح</h3>
                <p>شكراً لك، سيتم التواصل معك من فريق عاصمة الكون قريباً.</p>
              </div>
            ) : (
              <form onSubmit={submitResponse}>
                <div className="form-row-3">
                  <button
                    type="button"
                    className={`btn ${responseForm.decision === 'accepted' ? 'btn-success' : 'btn-secondary'}`}
                    onClick={() => setResponseForm(prev => ({ ...prev, decision: 'accepted' }))}
                  >
                    <Check size={18} />
                    موافق
                  </button>
                  <button
                    type="button"
                    className={`btn ${responseForm.decision === 'negotiation' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setResponseForm(prev => ({ ...prev, decision: 'negotiation' }))}
                  >
                    تفاوض
                  </button>
                  <button
                    type="button"
                    className={`btn ${responseForm.decision === 'rejected' ? 'btn-danger' : 'btn-secondary'}`}
                    onClick={() => setResponseForm(prev => ({ ...prev, decision: 'rejected' }))}
                  >
                    <X size={18} />
                    رافض
                  </button>
                </div>

                {responseForm.decision === 'negotiation' && (
                  <div className="form-group mt-24">
                    <label className="form-label">السعر المقترح</label>
                    <input
                      type="number"
                      className="form-input"
                      value={responseForm.negotiated_amount}
                      onChange={(event) => setResponseForm(prev => ({ ...prev, negotiated_amount: event.target.value }))}
                      min="0"
                      step="0.01"
                      placeholder="اكتب السعر المقترح"
                    />
                  </div>
                )}

                <div className="form-row mt-24">
                  <div className="form-group">
                    <label className="form-label">اسمك</label>
                    <input
                      className="form-input"
                      value={responseForm.customer_name}
                      onChange={(event) => setResponseForm(prev => ({ ...prev, customer_name: event.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">رقم التواصل</label>
                    <input
                      className="form-input"
                      value={responseForm.customer_phone}
                      onChange={(event) => setResponseForm(prev => ({ ...prev, customer_phone: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">ملاحظات</label>
                  <textarea
                    className="form-textarea"
                    value={responseForm.notes}
                    onChange={(event) => setResponseForm(prev => ({ ...prev, notes: event.target.value }))}
                    placeholder="اكتب ملاحظاتك أو سبب الرفض أو تفاصيل التفاوض..."
                    rows={4}
                  />
                </div>

                <button className="btn btn-primary btn-lg" type="submit" disabled={submitting}>
                  {submitting ? 'جاري إرسال الرد...' : 'إرسال الرد'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
