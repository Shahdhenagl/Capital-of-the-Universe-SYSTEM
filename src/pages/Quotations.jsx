import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, formatCurrency, formatDate, QUOTATION_STATUS, PAYMENT_FREQUENCIES, PAYMENT_METHODS, CITIES, logActivity } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Plus, Search, Send, Check, X, Eye, Filter, MessageCircle, Printer } from 'lucide-react';
import { useAutocomplete } from '../contexts/AutocompleteContext';
import SmartInput from '../components/SmartInput';
import ClientSearchSelect from '../components/ClientSearchSelect';
import PrintHeader from '../components/PrintHeader';
import PrintFooter from '../components/PrintFooter';

const QUOTATION_DETAIL_SECTIONS = [
  {
    key: 'project',
    title: 'بيانات المشروع',
    fields: [
      ['project_name', 'اسم المشروع'],
      ['project_location', 'موقع المشروع'],
      ['quotation_date', 'تاريخ العرض', 'date'],
      ['validity_period', 'مدة صلاحية العرض']
    ]
  },
  {
    key: 'elevator',
    title: 'مواصفات المصعد',
    fields: [
      ['elevator_type', 'نوع المصعد'],
      ['brand', 'الماركة'],
      ['capacity', 'الحمولة'],
      ['speed', 'السرعة'],
      ['stops', 'عدد الوقفات', 'number'],
      ['entrances', 'عدد المداخل', 'number'],
      ['drive_type', 'نوع التشغيل'],
      ['machine_type', 'نوع الماكينة'],
      ['control_type', 'نوع الكنترول'],
      ['shaft_dimensions', 'مقاس البئر'],
      ['cabin_dimensions', 'مقاس الكابينة'],
      ['door_dimensions', 'مقاس الأبواب'],
      ['travel_distance', 'مسافة الرحلة']
    ]
  },
  {
    key: 'finishes',
    title: 'التشطيبات',
    fields: [
      ['cabin_design', 'تصميم الكابينة'],
      ['cabin_finish', 'تشطيب الكابينة'],
      ['flooring', 'الأرضية'],
      ['ceiling', 'السقف'],
      ['doors_finish', 'تشطيب الأبواب'],
      ['operation_panels', 'لوحات التشغيل'],
      ['handrail_mirror', 'الدرابزين / المرآة']
    ]
  },
  {
    key: 'safety',
    title: 'السلامة والأنظمة',
    fields: [
      ['ard', 'جهاز الإنقاذ التلقائي'],
      ['door_sensor', 'حساس الباب'],
      ['overload_sensor', 'حساس زيادة الوزن'],
      ['speed_governor', 'حاكم السرعة'],
      ['intercom', 'الإنتركم'],
      ['emergency_light', 'إنارة الطوارئ'],
      ['fire_mode', 'وضع الحريق']
    ]
  },
  {
    key: 'execution',
    title: 'التنفيذ والضمان',
    fields: [
      ['supply_duration', 'مدة التوريد'],
      ['installation_duration', 'مدة التركيب'],
      ['warranty', 'الضمان'],
      ['maintenance_included', 'الصيانة المشمولة'],
      ['excluded_items', 'الأعمال غير المشمولة']
    ]
  },
  {
    key: 'financial',
    title: 'الشروط المالية',
    fields: [
      ['price_before_vat', 'السعر قبل الضريبة', 'number'],
      ['vat_amount', 'ضريبة القيمة المضافة', 'number'],
      ['payment_terms', 'شروط الدفع'],
      ['bank_details', 'بيانات التحويل']
    ]
  }
];

function createEmptyQuotationDetails() {
  return QUOTATION_DETAIL_SECTIONS.reduce((acc, section) => {
    acc[section.key] = {};
    section.fields.forEach(([field, , type]) => {
      if (type === 'checkbox') acc[section.key][field] = true;
    });
    return acc;
  }, {});
}

function parseQuotationDescription(description) {
  if (!description) return { plainDescription: '', details: createEmptyQuotationDetails() };
  try {
    const parsed = JSON.parse(description);
    return {
      plainDescription: parsed.plainDescription || '',
      details: {
        ...createEmptyQuotationDetails(),
        ...(parsed.details || {})
      }
    };
  } catch {
    return { plainDescription: description, details: createEmptyQuotationDetails() };
  }
}

function parseQuotationNotes(notes) {
  if (!notes) return {};
  try {
    return JSON.parse(notes);
  } catch {
    return { plainNotes: notes };
  }
}

function isMissingStorageBucket(error) {
  const message = `${error?.message || ''} ${error?.error || ''}`.toLowerCase();
  return message.includes('bucket not found') || message.includes('bucket_not_found');
}

function getSafeStoragePath(folder, file, fallbackExtension = 'pdf') {
  const rawExtension = file?.name?.split('.').pop() || fallbackExtension;
  const extension = rawExtension.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || fallbackExtension;
  const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${extension}`;
  return `${folder}/${uniqueName}`;
}

function Quotations({ cityFilter: globalCityFilter = 'all' }) {
  const { profile, hasPermission, isAdmin } = useAuth();
  const { saveMemory } = useAutocomplete();
  const navigate = useNavigate();

  const [quotations, setQuotations] = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');

  // PDF Printing state
  const [printItem, setPrintItem] = useState(null);

  function triggerPrint(quotation) {
    setPrintItem(quotation);
    setTimeout(() => {
      window.print();
      setPrintItem(null);
    }, 300);
  }

  // New quotation modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    client_id: '',
    service_id: '',
    title: '',
    description: '',
    details: createEmptyQuotationDetails(),
    amount: '',
    branch: 'mecca',
    pdf_file: null
  });

  // Accept quotation → create contract sub-modal
  const [showContractModal, setShowContractModal] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [contractForm, setContractForm] = useState({
    total_amount: '',
    payment_frequency: 'monthly',
    payment_method: 'cash',
    start_date: '',
    end_date: ''
  });
  const [savingContract, setSavingContract] = useState(false);

  useEffect(() => {
    fetchQuotations();
    fetchClients();
    fetchServices();
  }, []);

  useEffect(() => {
    setCityFilter(globalCityFilter || 'all');
  }, [globalCityFilter]);

  async function fetchQuotations() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('quotations')
        .select('*, clients(name, phone, city)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuotations(data || []);
    } catch (err) {
      console.error('خطأ في جلب عروض الأسعار:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchClients() {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, phone, city')
        .neq('status', 'inactive')
        .order('name');
      if (error) throw error;
      setClients(data || []);
    } catch (err) {
      console.error('خطأ في جلب العملاء:', err);
    }
  }

  async function fetchServices() {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .neq('is_active', false)
        .order('name');
      if (error) throw error;
      setServices(data || []);
    } catch (err) {
      console.error('خطأ في جلب الخدمات:', err);
    }
  }

  const filteredQuotations = quotations.filter(q => {
    const matchesSearch = !searchTerm ||
      (q.title && q.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (q.clients?.name && q.clients.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (q.quotation_number && q.quotation_number.includes(searchTerm));

    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
    const matchesCity = cityFilter === 'all' || q.branch === cityFilter || q.clients?.city === cityFilter;

    return matchesSearch && matchesStatus && matchesCity;
  });

  function handleFormChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function handleDetailChange(section, field, value) {
    setForm(prev => {
      const details = {
        ...prev.details,
        [section]: {
          ...prev.details[section],
          [field]: value
        }
      };
      const next = {
        ...prev,
        details
      };

      if (section === 'financial' && (field === 'price_before_vat' || field === 'vat_amount')) {
        const price = parseFloat(details.financial?.price_before_vat) || 0;
        const vat = parseFloat(details.financial?.vat_amount) || 0;
        if (price || vat) next.amount = (price + vat).toFixed(2);
      }

      return next;
    });
  }

  function handleContractFormChange(field, value) {
    setContractForm(prev => ({ ...prev, [field]: value }));
  }

  function resetForm() {
    setForm({
      client_id: '',
      service_id: '',
      title: '',
      description: '',
      details: createEmptyQuotationDetails(),
      amount: '',
      branch: 'mecca',
      pdf_file: null
    });
  }

  function buildQuotationDescription() {
    return JSON.stringify({
      plainDescription: form.description,
      details: form.details
    });
  }

  async function uploadQuotationPdf(file) {
    if (!file) return { url: null, warning: '' };

    const fileName = getSafeStoragePath('quotations', file, 'pdf');
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, file);

    if (uploadError) {
      if (isMissingStorageBucket(uploadError)) {
        return {
          url: null,
          warning: 'تم حفظ عرض السعر، لكن لم يتم رفع ملف PDF لأن Bucket documents غير موجود في Supabase.'
        };
      }
      throw uploadError;
    }

    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(fileName);

    return { url: urlData?.publicUrl || null, warning: '' };
  }

  async function handleAddQuotation(e) {
    e.preventDefault();
    if (!form.client_id || !form.title || !form.amount) return;

    try {
      setSaving(true);
      const selectedService = services.find(service => service.id === form.service_id);

      let pdfUrl = null;
      let uploadWarning = '';
      if (form.pdf_file) {
        const uploadResult = await uploadQuotationPdf(form.pdf_file);
        pdfUrl = uploadResult.url;
        uploadWarning = uploadResult.warning;
      }

      const quotationNumber = `QT-${Date.now().toString().slice(-8)}`;
      const quotationPayload = {
        quotation_number: quotationNumber,
        client_id: form.client_id,
        service_id: form.service_id || null,
        service_type: selectedService?.name || form.title,
        title: form.title,
        description: buildQuotationDescription(),
        amount: parseFloat(form.amount),
        branch: form.branch,
        status: 'pending_manager',
        pdf_url: pdfUrl,
        created_by: profile?.id
      };

      let { data, error } = await supabase
        .from('quotations')
        .insert(quotationPayload)
        .select()
        .single();

      if (error?.message?.includes('service_id')) {
        const { service_id, ...payloadWithoutServiceId } = quotationPayload;
        const fallback = await supabase
          .from('quotations')
          .insert(payloadWithoutServiceId)
          .select()
          .single();
        data = fallback.data;
        error = fallback.error;
      }

      if (error) throw error;

      await logActivity(
        profile?.id,
        profile?.full_name,
        'إنشاء عرض سعر',
        'quotations',
        data?.id,
        `عرض سعر جديد: ${form.title} - ${formatCurrency(parseFloat(form.amount))}`,
        profile?.branch
      );

      // Notify Sales Managers
      const { data: managers } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['admin', 'sales_manager']);
      
      if (managers && managers.length > 0) {
        const notifInserts = managers.map(m => ({
          user_id: m.id,
          title: 'عرض سعر بانتظار الاعتماد',
          message: `عرض سعر جديد (${form.title}) يحتاج لمراجعتك.`,
          type: 'warning',
          link: '/quotations'
        }));
        await supabase.from('notifications').insert(notifInserts);
      }

      // Save memory for autocomplete
      const memoryItems = [];
      if (form.title) memoryItems.push({ category: 'quotation_title', value: form.title });
      QUOTATION_DETAIL_SECTIONS.forEach(section => {
        section.fields.forEach(([field, label, type = 'text']) => {
          if (type === 'text' && form.details?.[section.key]?.[field]) {
            memoryItems.push({ category: field, value: form.details[section.key][field] });
          }
        });
      });
      saveMemory(memoryItems);

      resetForm();
      setShowAddModal(false);
      fetchQuotations();
      if (uploadWarning) alert(uploadWarning);
    } catch (err) {
      console.error('خطأ في إنشاء عرض السعر:', err);
      alert(`حدث خطأ أثناء إنشاء عرض السعر: ${err.message || 'خطأ غير معروف'}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(quotation, newStatus) {
    if (newStatus === 'final_approved') {
      setSelectedQuotation(quotation);
      setContractForm({
        total_amount: quotation.amount || '',
        payment_frequency: 'monthly',
        payment_method: 'cash',
        start_date: new Date().toISOString().split('T')[0],
        end_date: ''
      });
      setShowContractModal(true);
      return;
    }

    try {
      const { error } = await supabase
        .from('quotations')
        .update({ status: newStatus })
        .eq('id', quotation.id);

      if (error) throw error;

      await logActivity(
        profile?.id,
        profile?.full_name,
        `تغيير حالة عرض السعر إلى ${QUOTATION_STATUS[newStatus]}`,
        'quotations',
        quotation.id,
        `${quotation.title} → ${QUOTATION_STATUS[newStatus]}`,
        profile?.branch
      );

      // Notify the quotation creator if status changed by someone else
      if (quotation.created_by && quotation.created_by !== profile?.id) {
        if (newStatus === 'manager_approved' || newStatus === 'manager_rejected' || newStatus === 'final_approved' || newStatus === 'final_rejected') {
          await supabase.from('notifications').insert({
            user_id: quotation.created_by,
            title: `تحديث حالة العرض`,
            message: `تم تغيير حالة العرض (${quotation.title}) إلى: ${QUOTATION_STATUS[newStatus]}`,
            type: newStatus.includes('approved') ? 'success' : 'danger',
            link: '/quotations'
          });
        }
      }

      fetchQuotations();
    } catch (err) {
      console.error('خطأ في تحديث الحالة:', err);
    }
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

  async function handleAcceptAndCreateContract(e) {
    e.preventDefault();
    if (!contractForm.total_amount || !contractForm.start_date || !contractForm.end_date) return;

    try {
      setSavingContract(true);

      // Update quotation status
      const { error: quotError } = await supabase
        .from('quotations')
        .update({ status: 'accepted' })
        .eq('id', selectedQuotation.id);

      if (quotError) throw quotError;

      // Create contract
      const contractNumber = `CT-${Date.now().toString().slice(-8)}`;
      const { data: contractData, error: contractError } = await supabase
        .from('contracts')
        .insert({
          contract_number: contractNumber,
          client_id: selectedQuotation.client_id,
          quotation_id: selectedQuotation.id,
          service_type: selectedQuotation.service_type || selectedQuotation.title || 'عرض سعر',
          title: selectedQuotation.title || selectedQuotation.service_type || 'عقد من عرض سعر',
          total_amount: parseFloat(contractForm.total_amount),
          payment_frequency: contractForm.payment_frequency,
          payment_method: contractForm.payment_method,
          start_date: contractForm.start_date,
          end_date: contractForm.end_date,
          status: 'active',
          branch: selectedQuotation.branch,
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
        client_id: selectedQuotation.client_id,
        due_date: date.toISOString().split('T')[0],
        amount: Math.round(installmentAmount * 100) / 100,
        status: 'pending',
        branch: selectedQuotation.branch
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
        selectedQuotation.id,
        `تم قبول العرض وإنشاء العقد ${contractNumber} بقيمة ${formatCurrency(totalAmount)}`,
        profile?.branch
      );

      setShowContractModal(false);
      setSelectedQuotation(null);
      fetchQuotations();
    } catch (err) {
      console.error('خطأ في قبول العرض:', err);
      alert(`حدث خطأ أثناء قبول عرض السعر وإنشاء العقد: ${err.message || 'خطأ غير معروف'}`);
    } finally {
      setSavingContract(false);
    }
  }

  function sendWhatsApp(quotation) {
    const clientPhone = quotation.clients?.phone || '';
    const phone = clientPhone.replace(/^0/, '966');
    const publicLink = `${window.location.origin}/q/${quotation.id}`;
    const message = encodeURIComponent(
      `مرحباً،\n` +
      `نود إبلاغكم بعرض السعر التالي من شركة عاصمة الكون:\n\n` +
      `📋 العنوان: ${quotation.title || ''}\n` +
      `💰 المبلغ: ${formatCurrency(quotation.amount)}\n` +
      `📅 التاريخ: ${formatDate(quotation.created_at)}\n\n` +
      `يمكنكم فتح عرض السعر والرد بالموافقة أو الرفض أو التفاوض من الرابط التالي:\n${publicLink}\n\n` +
      `نتطلع لتعاونكم معنا.\nشكراً لكم.`
    );
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  }

  function getStatusBadgeClass(status) {
    const map = {
      pending: 'badge-warning',
      accepted: 'badge-success',
      rejected: 'badge-danger'
    };
    return map[status] || 'badge-secondary';
  }

  function getQuotationDetailRows(quotation) {
    const parsed = parseQuotationDescription(quotation.description);
    return QUOTATION_DETAIL_SECTIONS.flatMap(section =>
      section.fields
        .map(([field, label]) => ({
          section: section.title,
          label,
          value: parsed.details?.[section.key]?.[field]
        }))
        .filter(row => row.value)
    );
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
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">
          <span className="title-icon" style={{ background: 'var(--info-bg)', color: 'var(--info-light)' }}>
            <FileText size={28} />
          </span>
          عروض الأسعار
        </h1>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={18} />
            عرض سعر جديد
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="بحث بالعنوان أو اسم العميل..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <button
            className={`city-filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            الكل
          </button>
          <button
            className={`city-filter-btn ${statusFilter === 'pending_manager' ? 'active' : ''}`}
            onClick={() => setStatusFilter('pending_manager')}
          >
            بانتظار الإدارة
          </button>
          <button
            className={`city-filter-btn ${statusFilter === 'manager_approved' ? 'active' : ''}`}
            onClick={() => setStatusFilter('manager_approved')}
          >
            معتمد
          </button>
          <button
            className={`city-filter-btn ${statusFilter === 'sent' ? 'active' : ''}`}
            onClick={() => setStatusFilter('sent')}
          >
            مرسل للعميل
          </button>
          <button
            className={`city-filter-btn ${statusFilter === 'final_approved' ? 'active' : ''}`}
            onClick={() => setStatusFilter('final_approved')}
          >
            مقبول نهائياً
          </button>
        </div>
        <div className="filter-group">
          <button
            className={`city-filter-btn ${cityFilter === 'all' ? 'active' : ''}`}
            onClick={() => setCityFilter('all')}
          >
            كل الفروع
          </button>
          <button
            className={`city-filter-btn ${cityFilter === 'mecca' ? 'active' : ''}`}
            onClick={() => setCityFilter('mecca')}
          >
            مكة
          </button>
          <button
            className={`city-filter-btn ${cityFilter === 'jeddah' ? 'active' : ''}`}
            onClick={() => setCityFilter('jeddah')}
          >
            جدة
          </button>
        </div>
      </div>

      {/* Quotations Table */}
      {filteredQuotations.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <FileText size={64} />
          </div>
          <h3>لا توجد عروض أسعار</h3>
          <p>أنشئ عرض سعر جديد للبدء</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>رقم العرض</th>
                <th>العميل</th>
                <th>العنوان</th>
                <th>المبلغ</th>
                <th>الحالة</th>
                <th>التاريخ</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotations.map(q => (
                <tr key={q.id}>
                  <td>{q.quotation_number || q.id?.slice(0, 8)}</td>
                  <td>{q.clients?.name || '-'}</td>
                  <td>{q.title || '-'}</td>
                  <td>{formatCurrency(q.amount)}</td>
                  <td>
                    <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
                      <span className={`badge ${getStatusBadgeClass(q.status)}`}>
                        {QUOTATION_STATUS[q.status] || q.status}
                      </span>
                      {parseQuotationNotes(q.notes).client_response && (
                        <span className="badge badge-info">
                          رد العميل: {parseQuotationNotes(q.notes).client_response.decision === 'accepted' ? 'موافق' : parseQuotationNotes(q.notes).client_response.decision === 'rejected' ? 'رافض' : 'تفاوض'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{formatDate(q.created_at)}</td>
                  <td>
                    <div className="flex gap-8">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => navigate(`/quotations/${q.id}`)}
                        title="عرض التفاصيل"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => triggerPrint(q)}
                        title="تصدير كـ PDF / طباعة"
                      >
                        <Printer size={16} className="text-primary" />
                      </button>

                      {/* Sales Manager & Admin Actions */}
                      {(isAdmin || profile?.role === 'sales_manager') && q.status === 'pending_manager' && (
                        <>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleStatusChange(q, 'manager_approved')}
                            title="اعتماد الإدارة"
                          >
                            <Check size={16} className="text-success" />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleStatusChange(q, 'manager_rejected')}
                            title="رفض الإدارة"
                          >
                            <X size={16} className="text-danger" />
                          </button>
                        </>
                      )}

                      {/* Manager Final Decision Actions */}
                      {(isAdmin || profile?.role === 'sales_manager') && ['client_accepted', 'client_negotiating', 'client_rejected'].includes(q.status) && (
                        <>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleStatusChange(q, 'final_approved')} // Will open contract modal
                            title="اعتماد نهائي (تحويل لعقد)"
                          >
                            <Check size={16} className="text-success" />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleStatusChange(q, 'final_rejected')}
                            title="رفض نهائي"
                          >
                            <X size={16} className="text-danger" />
                          </button>
                        </>
                      )}

                      {/* Sales Rep / Admin Actions */}
                      {(isAdmin || profile?.role === 'sales_rep') && q.status === 'manager_approved' && (
                        <>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              handleStatusChange(q, 'sent');
                              sendWhatsApp(q);
                            }}
                            title="إرسال للعميل"
                          >
                            <Send size={16} className="text-primary" />
                          </button>
                        </>
                      )}

                      {(isAdmin || profile?.role === 'sales_rep') && q.status === 'sent' && (
                        <div className="dropdown">
                          <button className="btn btn-ghost btn-sm" title="رد العميل">
                            <MessageCircle size={16} className="text-info" />
                          </button>
                          <div className="dropdown-content">
                            <button onClick={() => handleStatusChange(q, 'client_accepted')}>العميل موافق</button>
                            <button onClick={() => handleStatusChange(q, 'client_negotiating')}>العميل يتفاوض</button>
                            <button onClick={() => handleStatusChange(q, 'client_rejected')}>العميل رافض</button>
                          </div>
                        </div>
                      )}
                      
                      {/* Legacy actions support */}
                      {q.status === 'pending' && isAdmin && (
                        <>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleStatusChange(q, 'manager_approved')} title="تحويل للإدارة"><Check size={16} className="text-success" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Quotation Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">عرض سعر جديد</h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddQuotation}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">العميل *</label>
                    <ClientSearchSelect
                      value={form.client_id}
                      onSelect={(client) => {
                        if (!clients.find(c => c.id === client.id)) {
                          setClients(prev => [client, ...prev]);
                        }
                        handleFormChange('client_id', client.id);
                      }}
                      onClear={() => handleFormChange('client_id', '')}
                      clients={clients}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">نوع الخدمة</label>
                    <select
                      className="form-select"
                      value={form.service_id}
                      onChange={(e) => handleFormChange('service_id', e.target.value)}
                    >
                      <option value="">اختر الخدمة</option>
                      {services.map(s => (
                        <option key={s.id} value={s.id}>{s.name} {s.price ? `(${formatCurrency(s.price)})` : ''}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">عنوان العرض *</label>
                  <SmartInput
                    category="quotation_title"
                    className="form-input"
                    value={form.title}
                    onChange={(e) => handleFormChange('title', e.target.value)}
                    placeholder="مثال: صيانة مصاعد سنوية"
                    required
                  />
                </div>

                {QUOTATION_DETAIL_SECTIONS.map(section => (
                  <div className="card mb-24" key={section.key}>
                    <div className="card-header">
                      <h3 className="card-title">{section.title}</h3>
                    </div>
                    <div className="card-body">
                      <div className="form-row-3">
                        {section.fields.map(([field, label, type = 'text']) => (
                          <div className="form-group" key={`${section.key}-${field}`}>
                            <label className="form-label">{label}</label>
                            {type === 'checkbox' ? (
                              <div className="flex items-center gap-8 mt-8">
                                <input
                                  type="checkbox"
                                  checked={form.details?.[section.key]?.[field] === true || form.details?.[section.key]?.[field] === 'مشمول'}
                                  onChange={(e) => handleDetailChange(section.key, field, e.target.checked)}
                                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                />
                                <span>مشمول</span>
                              </div>
                            ) : type === 'text' ? (
                              <SmartInput
                                category={field}
                                type={type}
                                className="form-input"
                                value={form.details?.[section.key]?.[field] || ''}
                                onChange={(e) => handleDetailChange(section.key, field, e.target.value)}
                              />
                            ) : (
                              <input
                                type={type}
                                className="form-input"
                                value={form.details?.[section.key]?.[field] || ''}
                                onChange={(e) => handleDetailChange(section.key, field, e.target.value)}
                                min={type === 'number' ? '0' : undefined}
                                step={type === 'number' ? '0.01' : undefined}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                <div className="form-group">
                  <label className="form-label">ملاحظات إضافية على العرض</label>
                  <textarea
                    className="form-textarea"
                    value={form.description}
                    onChange={(e) => handleFormChange('description', e.target.value)}
                    placeholder="أي شروط أو ملاحظات إضافية..."
                  ></textarea>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">المبلغ (ر.س) *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={form.amount}
                      onChange={(e) => handleFormChange('amount', e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">الفرع</label>
                    <select
                      className="form-select"
                      value={form.branch}
                      onChange={(e) => handleFormChange('branch', e.target.value)}
                    >
                      <option value="mecca">مكة المكرمة</option>
                      <option value="jeddah">جدة</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">ملف PDF (اختياري)</label>
                  <input
                    type="file"
                    className="form-input"
                    accept=".pdf"
                    onChange={(e) => handleFormChange('pdf_file', e.target.files[0] || null)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <Plus size={18} />
                  {saving ? 'جاري الإنشاء...' : 'إنشاء عرض السعر'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Accept Quotation → Create Contract Modal */}
      {showContractModal && selectedQuotation && (
        <div className="modal-overlay" onClick={() => setShowContractModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">قبول العرض وإنشاء عقد</h2>
              <button className="modal-close" onClick={() => setShowContractModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAcceptAndCreateContract}>
              <div className="modal-body">
                <div className="card mb-24">
                  <div className="card-body">
                    <p className="text-muted">عرض السعر: <strong>{selectedQuotation.title}</strong></p>
                    <p className="text-muted">العميل: <strong>{selectedQuotation.clients?.name}</strong></p>
                  </div>
                </div>

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

          {getQuotationDetailRows(printItem).length > 0 ? (
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
                    <td><strong>{row.value}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

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

export default Quotations;
