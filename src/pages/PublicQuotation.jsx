import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, FileText, Globe, Mail, MapPin, MessageSquare, Phone, Printer, X } from 'lucide-react';
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

const companyContacts = [
  {
    city: 'مكة المكرمة',
    phones: [
      { number: '0544113161', whatsapp: 'https://wa.me/966544113161' },
      { number: '0544600116', whatsapp: 'https://wa.me/966544600116' }
    ]
  },
  {
    city: 'جدة',
    phones: [
      { number: '0544113161', whatsapp: 'https://wa.me/966544113161' },
      { number: '0504413330', whatsapp: 'https://wa.me/966504413330' }
    ]
  }
];

const publicStyles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0f172a 0%, #111827 360px, #f8fafc 360px, #f8fafc 100%)',
    padding: '28px 18px 48px'
  },
  shell: { maxWidth: '1080px', margin: '0 auto' },
  hero: {
    background: '#ffffff',
    borderRadius: '18px',
    padding: '26px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 22px 60px rgba(15, 23, 42, 0.18)'
  },
  heroTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '18px', flexWrap: 'wrap' },
  brand: { display: 'flex', alignItems: 'center', gap: '14px' },
  logo: { width: '64px', height: '64px', objectFit: 'contain' },
  eyebrow: { color: '#0284c7', fontWeight: 800, margin: 0 },
  title: { color: '#0f172a', fontSize: '2rem', lineHeight: 1.25, margin: '6px 0 0' },
  priceBox: { background: '#ecfdf5', border: '1px solid #bbf7d0', color: '#047857', borderRadius: '14px', padding: '16px 20px', minWidth: '220px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px', marginTop: '24px' },
  infoBox: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px' },
  card: { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '22px', marginTop: '18px' },
  contactGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' },
  contactBox: { background: '#f8fafc', border: '1px solid #dbeafe', borderRadius: '14px', padding: '16px' },
  actionLink: { display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#0369a1', fontWeight: 800, textDecoration: 'none', marginInlineEnd: '12px', marginTop: '8px' },
  responseCard: { background: '#0f172a', color: '#ffffff', borderRadius: '18px', padding: '22px', marginTop: '18px' }
};

function friendlyError(message) {
  if (message?.includes('Invalid API key')) {
    return 'تعذر فتح عرض السعر حاليًا بسبب إعداد مفتاح Supabase على السيرفر. برجاء تحديث متغيرات Vercel ثم إعادة المحاولة.';
  }
  return message || 'تعذر تحميل عرض السعر';
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
      setError(friendlyError(err.message));
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
      alert(friendlyError(err.message));
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
    <div dir="rtl" style={publicStyles.page}>
      <div style={publicStyles.shell}>
        <div style={publicStyles.hero}>
          <div style={publicStyles.heroTop}>
            <div style={publicStyles.brand}>
              <img src="/logo-transparent.png" alt="عاصمة الكون" style={publicStyles.logo} />
              <div>
                <p style={publicStyles.eyebrow}>شركة عاصمة الكون للمصاعد</p>
                <h1 style={publicStyles.title}>عرض سعر رسمي</h1>
                <p className="text-muted" style={{ marginTop: '8px' }}>
                  رقم العرض: {quotation.quotation_number || quotation.id?.slice(0, 8)}
                </p>
              </div>
            </div>
            <div style={publicStyles.priceBox}>
              <span style={{ display: 'block', color: '#047857', fontWeight: 700 }}>إجمالي العرض</span>
              <strong style={{ display: 'block', fontSize: '1.6rem', marginTop: '6px' }}>{formatCurrency(quotation.amount)}</strong>
            </div>
          </div>

          <div style={publicStyles.grid}>
            <div style={publicStyles.infoBox}>
              <span className="form-label">العميل</span>
              <p className="font-bold" style={{ color: '#0f172a' }}>{quotation.clients?.name || '-'}</p>
            </div>
            <div style={publicStyles.infoBox}>
              <span className="form-label">تاريخ العرض</span>
              <p className="font-bold" style={{ color: '#0f172a' }}>{formatDate(quotation.created_at)}</p>
            </div>
            <div style={publicStyles.infoBox}>
              <span className="form-label">الفرع</span>
              <p className="font-bold" style={{ color: '#0f172a' }}>{CITIES[quotation.branch] || quotation.branch || '-'}</p>
            </div>
            <div style={publicStyles.infoBox}>
              <span className="form-label">عنوان العرض</span>
              <p className="font-bold" style={{ color: '#0f172a' }}>{quotation.title || '-'}</p>
            </div>
          </div>

          <div className="flex gap-8 mt-24">
            <button className="btn btn-primary" onClick={() => document.getElementById('client-response')?.scrollIntoView({ behavior: 'smooth' })}>
              <MessageSquare size={18} />
              الرد على العرض
            </button>
            <button className="btn btn-secondary" onClick={() => window.print()}>
              <Printer size={18} />
              طباعة / حفظ PDF
            </button>
          </div>
        </div>

        {rows.length > 0 && (
          <div style={publicStyles.card}>
            <h3 className="font-bold mb-16">تفاصيل ومواصفات العرض</h3>
            <div className="table-container">
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
          <div style={publicStyles.card}>
            <h3 className="font-bold mb-16">ملاحظات إضافية</h3>
            <p className="text-muted" style={{ whiteSpace: 'pre-wrap' }}>{parsedDescription.plainDescription}</p>
          </div>
        )}

        <div style={publicStyles.card}>
          <h3 className="font-bold mb-16">تواصل معنا</h3>
          <div style={publicStyles.contactGrid}>
            {companyContacts.map(branch => (
              <div key={branch.city} style={publicStyles.contactBox}>
                <h4 className="font-bold" style={{ color: '#0f172a', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <MapPin size={18} />
                  {branch.city}
                </h4>
                {branch.phones.map(phone => (
                  <div key={phone.number} style={{ marginTop: '12px' }}>
                    <a href={`tel:${phone.number}`} style={publicStyles.actionLink}>
                      <Phone size={16} />
                      {phone.number}
                    </a>
                    <a href={phone.whatsapp} target="_blank" rel="noreferrer" style={publicStyles.actionLink}>
                      <MessageSquare size={16} />
                      واتساب
                    </a>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="flex gap-16 mt-16" style={{ flexWrap: 'wrap' }}>
            <a href="mailto:sales@capital-of-universe.com" style={publicStyles.actionLink}>
              <Mail size={16} />
              sales@capital-of-universe.com
            </a>
            <a href="https://capitalofuniverse-ksa.com" target="_blank" rel="noreferrer" style={publicStyles.actionLink}>
              <Globe size={16} />
              capitalofuniverse-ksa.com
            </a>
          </div>
        </div>

        <div id="client-response" style={publicStyles.responseCard}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <MessageSquare size={20} />
            رد العميل على عرض السعر
          </h3>
          {submitted ? (
            <div className="empty-state" style={{ color: '#fff' }}>
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
                  <label className="form-label" style={{ color: '#cbd5e1' }}>السعر المقترح</label>
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
                  <label className="form-label" style={{ color: '#cbd5e1' }}>اسمك</label>
                  <input
                    className="form-input"
                    value={responseForm.customer_name}
                    onChange={(event) => setResponseForm(prev => ({ ...prev, customer_name: event.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#cbd5e1' }}>رقم التواصل</label>
                  <input
                    className="form-input"
                    value={responseForm.customer_phone}
                    onChange={(event) => setResponseForm(prev => ({ ...prev, customer_phone: event.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ color: '#cbd5e1' }}>ملاحظات</label>
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
  );
}
