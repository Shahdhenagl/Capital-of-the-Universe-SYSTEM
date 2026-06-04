import { useMemo, useState } from 'react';
import { Plus, X, Building2, Trash2 } from 'lucide-react';
import { supabase, CITIES } from '../lib/supabase';

const emptySiteForm = {
  site_name: '',
  address: '',
  city: 'mecca',
  elevator_count: 1,
  floor_count: '',
  elevator_type: '',
  responsible_name: '',
  responsible_phone: '',
  elevator_codes: [''],
  commercial_record: '',
  tax_number: '',
  notes: ''
};

function normalizeSitePayload(clientId, form) {
  return {
    client_id: clientId,
    site_name: form.site_name.trim(),
    address: form.address || null,
    city: form.city || 'mecca',
    elevator_count: parseInt(form.elevator_count, 10) || 1,
    floor_count: parseInt(form.floor_count, 10) || 0,
    elevator_type: form.elevator_type || null,
    responsible_name: form.responsible_name || null,
    responsible_phone: form.responsible_phone || null,
    elevator_codes: (form.elevator_codes || []).map(code => String(code).trim()).filter(Boolean),
    commercial_record: form.commercial_record || null,
    tax_number: form.tax_number || null,
    notes: form.notes || null
  };
}

async function insertClientSite(payload) {
  const insert = await supabase.from('client_sites').insert(payload).select().single();
  if (!insert.error) return insert;

  const message = insert.error?.message || '';
  if (!message.includes('commercial_record') && !message.includes('tax_number')) {
    return insert;
  }

  const { commercial_record, tax_number, ...fallbackPayload } = payload;
  return supabase.from('client_sites').insert(fallbackPayload).select().single();
}

export default function ClientSiteSelect({
  clientId,
  value,
  sites = [],
  onChange,
  onSitesChange,
  onCreate,
  disabled = false,
  required = false
}) {
  const [showForm, setShowForm] = useState(false);
  const [siteForm, setSiteForm] = useState(emptySiteForm);
  const [saving, setSaving] = useState(false);

  const selectedSite = useMemo(() => sites.find(site => site.id === value), [sites, value]);

  function updateSiteForm(field, fieldValue) {
    setSiteForm(prev => ({ ...prev, [field]: fieldValue }));
  }

  function updateElevatorCode(index, code) {
    setSiteForm(prev => ({
      ...prev,
      elevator_codes: (prev.elevator_codes || ['']).map((item, itemIndex) => itemIndex === index ? code : item)
    }));
  }

  function addElevatorCode() {
    setSiteForm(prev => ({ ...prev, elevator_codes: [...(prev.elevator_codes || []), ''] }));
  }

  function removeElevatorCode(index) {
    setSiteForm(prev => ({
      ...prev,
      elevator_codes: (prev.elevator_codes || []).filter((_, itemIndex) => itemIndex !== index).length
        ? (prev.elevator_codes || []).filter((_, itemIndex) => itemIndex !== index)
        : ['']
    }));
  }

  function openForm() {
    setSiteForm(prev => ({
      ...emptySiteForm,
      city: selectedSite?.city || prev.city || 'mecca'
    }));
    setShowForm(true);
  }

  async function handleSaveSite(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (!clientId || !siteForm.site_name.trim()) return;

    setSaving(true);
    try {
      const payload = normalizeSitePayload(clientId, siteForm);
      const { data, error } = await insertClientSite(payload);
      if (error) throw error;

      const nextSites = [data, ...sites.filter(site => site.id !== data.id)];
      onSitesChange?.(nextSites);
      onChange?.(data.id, data);
      onCreate?.(data);
      setShowForm(false);
      setSiteForm(emptySiteForm);
    } catch (err) {
      console.error('Error creating client site:', err);
      alert(`حدث خطأ أثناء إضافة المبنى: ${err.message || 'خطأ غير معروف'}`);
    } finally {
      setSaving(false);
    }
  }

  function stopInlineFormEvent(event) {
    event.stopPropagation();
  }

  function handleInlineFormKeyDown(event) {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSaveSite(event);
    }
  }

  if (!clientId) {
    return (
      <div className="empty-state" style={{ padding: '16px', minHeight: 'auto' }}>
        <p>اختاري العميل أولاً لعرض مبانيه وإضافة مبنى جديد.</p>
      </div>
    );
  }

  return (
    <div className="client-site-select">
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">المبنى / موقع العميل {required ? '*' : ''}</label>
          <select
            className="form-select"
            value={value || ''}
            onChange={event => onChange?.(event.target.value, sites.find(site => site.id === event.target.value))}
            disabled={disabled}
            required={required}
          >
            <option value="">بدون ربط مبنى</option>
            {sites.map(site => (
              <option key={site.id} value={site.id}>
                {site.site_name} {site.address ? `- ${site.address}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ justifyContent: 'flex-end' }}>
          <label className="form-label">&nbsp;</label>
          <button type="button" className="btn btn-secondary" onClick={openForm} disabled={disabled}>
            <Plus size={18} />
            إضافة مبنى جديد
          </button>
        </div>
      </div>

      {selectedSite && (
        <div className="client-site-summary">
          <Building2 size={18} />
          <div>
            <strong>{selectedSite.site_name}</strong>
            <p className="text-muted">
              {[selectedSite.address, CITIES[selectedSite.city] || selectedSite.city, selectedSite.elevator_count ? `${selectedSite.elevator_count} مصعد` : '']
                .filter(Boolean)
                .join(' - ')}
            </p>
          </div>
        </div>
      )}

      {showForm && (
        <div
          className="inline-site-form"
          onClick={stopInlineFormEvent}
          onMouseDown={stopInlineFormEvent}
          onKeyDown={handleInlineFormKeyDown}
        >
          <div className="inline-site-form-header">
            <h4>إضافة مبنى للعميل</h4>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>
              <X size={16} />
            </button>
          </div>
          <div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">اسم المبنى / الموقع *</label>
                <input className="form-input" value={siteForm.site_name} onChange={e => updateSiteForm('site_name', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">المدينة</label>
                <select className="form-select" value={siteForm.city} onChange={e => updateSiteForm('city', e.target.value)}>
                  {Object.entries(CITIES).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">العنوان</label>
              <input className="form-input" value={siteForm.address} onChange={e => updateSiteForm('address', e.target.value)} />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">اسم المسؤول</label>
                <input className="form-input" value={siteForm.responsible_name} onChange={e => updateSiteForm('responsible_name', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">جوال المسؤول</label>
                <input className="form-input" value={siteForm.responsible_phone} onChange={e => updateSiteForm('responsible_phone', e.target.value)} />
              </div>
            </div>

            <div className="form-row-3">
              <div className="form-group">
                <label className="form-label">عدد المصاعد</label>
                <input type="number" className="form-input" min="1" value={siteForm.elevator_count} onChange={e => updateSiteForm('elevator_count', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">عدد الأدوار</label>
                <input type="number" className="form-input" min="0" value={siteForm.floor_count} onChange={e => updateSiteForm('floor_count', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">نوع المصعد</label>
                <input className="form-input" value={siteForm.elevator_type} onChange={e => updateSiteForm('elevator_type', e.target.value)} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">السجل التجاري</label>
                <input className="form-input" value={siteForm.commercial_record} onChange={e => updateSiteForm('commercial_record', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">الرقم الضريبي</label>
                <input className="form-input" value={siteForm.tax_number} onChange={e => updateSiteForm('tax_number', e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">أكواد المصاعد</label>
              {(siteForm.elevator_codes || ['']).map((code, index) => (
                <div className="flex gap-8 mb-8" key={index}>
                  <input className="form-input" value={code} onChange={e => updateElevatorCode(index, e.target.value)} placeholder={`كود المصعد ${index + 1}`} />
                  <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => removeElevatorCode(index)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn-secondary btn-sm" onClick={addElevatorCode}>
                <Plus size={16} />
                إضافة كود
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">ملاحظات</label>
              <textarea className="form-textarea" value={siteForm.notes} onChange={e => updateSiteForm('notes', e.target.value)} />
            </div>

            <div className="flex gap-8" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>إلغاء</button>
              <button type="button" className="btn btn-primary" onClick={handleSaveSite} disabled={saving}>
                {saving ? 'جاري الحفظ...' : 'حفظ وربط المبنى'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
