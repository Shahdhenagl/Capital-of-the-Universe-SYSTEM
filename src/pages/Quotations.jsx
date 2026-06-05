import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, formatCurrency, formatDate, QUOTATION_STATUS, PAYMENT_FREQUENCIES, PAYMENT_METHODS, CITIES, logActivity, formatUserName, ROLES } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Plus, Search, Send, Check, X, Eye, Filter, MessageCircle, Printer } from 'lucide-react';
import { useAutocomplete } from '../contexts/AutocompleteContext';
import SmartInput from '../components/SmartInput';
import ClientSearchSelect from '../components/ClientSearchSelect';
import ClientSiteSelect from '../components/ClientSiteSelect';
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
      ['ard', 'جهاز الإنقاذ التلقائي', 'checkbox'],
      ['door_sensor', 'حساس الباب', 'checkbox'],
      ['overload_sensor', 'حساس زيادة الوزن', 'checkbox'],
      ['speed_governor', 'حاكم السرعة', 'checkbox'],
      ['intercom', 'الإنتركم', 'checkbox'],
      ['emergency_light', 'إنارة الطوارئ', 'checkbox'],
      ['fire_mode', 'وضع الحريق', 'checkbox']
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

function mergeQuotationNotes(notes, patch) {
  return JSON.stringify({
    ...parseQuotationNotes(notes),
    ...patch
  });
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
    }, 500);
  }

  // New quotation modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    client_id: '',
    client_site_id: '',
    service_id: '',
    title: '',
    description: '',
    details: createEmptyQuotationDetails(),
    amount: '',
    branch: 'mecca',
    pdf_file: null
  });
  const [clientSites, setClientSites] = useState([]);

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
  const [sendAfterCreate, setSendAfterCreate] = useState(true);

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

  async function fetchNotificationUsers(roles = []) {
    const query = supabase.from('profiles').select('id, role').neq('is_active', false);
    if (roles.length) query.in('role', roles);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async function notifyUsers(users, title, message, type = 'info', link = '/quotations') {
    const uniqueUsers = Array.from(new Map((users || []).filter(u => u?.id).map(u => [u.id, u])).values());
    if (!uniqueUsers.length) return;
    await supabase.from('notifications').insert(uniqueUsers.map(user => ({
      user_id: user.id,
      title,
      message,
      type,
      link
    })));
  }

  function handleClientSelect(client, sites = []) {
    if (!clients.find(c => c.id === client.id)) {
      setClients(prev => [client, ...prev]);
    }
    setClientSites(sites || []);
    setForm(prev => ({
      ...prev,
      client_id: client.id,
      client_site_id: '',
      branch: client.city || prev.branch
    }));
  }

  function handleClientClear() {
    setClientSites([]);
    setForm(prev => ({
      ...prev,
      client_id: '',
      client_site_id: ''
    }));
  }

  function handleClientSitesChange(nextSites) {
    setClientSites(nextSites || []);
  }

  function handleClientSiteChange(siteId, site) {
    setForm(prev => ({
      ...prev,
      client_site_id: siteId,
      branch: site?.city || prev.branch,
      details: {
        ...prev.details,
        links: {
          ...prev.details.links,
          client_site_id: siteId || null
        },
        project: {
          ...prev.details.project,
          project_name: site?.site_name || prev.details.project?.project_name || '',
          project_location: site?.address || prev.details.project?.project_location || ''
        },
        elevator: {
          ...prev.details.elevator,
          elevator_type: site?.elevator_type || prev.details.elevator?.elevator_type || ''
        }
      }
    }));
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
      client_site_id: '',
      service_id: '',
      title: '',
      description: '',
      details: createEmptyQuotationDetails(),
      amount: '',
      branch: 'mecca',
      pdf_file: null
    });
    setClientSites([]);
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
      const employeeName = formatUserName(profile?.full_name || profile?.email);
      const roleName = ROLES[profile?.role] || profile?.role || 'موظف';
      const clientName = clients.find(c => c.id === form.client_id)?.name || 'عميل';
      const managers = await fetchNotificationUsers(['admin', 'manager']);
      await notifyUsers(
        managers,
        'عرض سعر بانتظار الاعتماد',
        `${roleName} ${employeeName} أنشأ عرض سعر جديد (${form.title}) للعميل ${clientName} بقيمة ${formatCurrency(parseFloat(form.amount))} - يحتاج لمراجعة المدير.`,
        'warning',
        '/quotations'
      );

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
      const needsManagerNote = ['manager_approved', 'manager_rejected', 'final_rejected'].includes(newStatus);
      const managerNote = needsManagerNote
        ? window.prompt('اكتبي ملاحظة القرار للمندوب:', '')
        : '';
      if (managerNote === null) return;

      const statusPatch = { status: newStatus };
      if (['manager_rejected', 'final_rejected'].includes(newStatus)) {
        statusPatch.rejection_reason = managerNote || QUOTATION_STATUS[newStatus];
      }
      if (needsManagerNote) {
        const noteKey = newStatus === 'manager_approved' ? 'manager_response' : 'manager_rejection';
        statusPatch.notes = mergeQuotationNotes(quotation.notes, {
          [noteKey]: {
            status: newStatus,
            note: managerNote || '',
            by: formatUserName(profile?.full_name || profile?.email),
            at: new Date().toISOString()
          }
        });
      }

      const { error } = await supabase
        .from('quotations')
        .update(statusPatch)
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

      const statusEmployeeName = formatUserName(profile?.full_name || profile?.email);
      const statusRoleName = ROLES[profile?.role] || profile?.role || 'موظف';
      const statusClientName = quotation.clients?.name || 'عميل';
      const recipients = [];
      if (quotation.created_by) recipients.push({ id: quotation.created_by });
      if (['client_accepted', 'client_negotiating', 'client_rejected'].includes(newStatus)) {
        recipients.push(...await fetchNotificationUsers(['admin', 'manager']));
      }
      await notifyUsers(
        recipients,
        'تحديث حالة عرض السعر',
        `${statusRoleName} ${statusEmployeeName} غيّر حالة عرض السعر (${quotation.title}) للعميل ${statusClientName} إلى: ${QUOTATION_STATUS[newStatus]}${managerNote ? ` - ملاحظة: ${managerNote}` : ''}`,
        newStatus.includes('approved') || newStatus.includes('accepted') ? 'success' : newStatus.includes('rejected') ? 'danger' : 'warning',
        `/quotations/${quotation.id}`
      );

      // Play sound feedback for the local user depending on the new status
      try {
        if (newStatus.includes('accepted')) playNotificationSound('accept');
        else if (newStatus.includes('rejected')) playNotificationSound('reject');
        else if (newStatus.includes('negotiat')) playNotificationSound('negotiation');
        else playNotificationSound('default');
      } catch (e) {
        // ignore audio errors
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
        .update({
          status: 'final_approved',
          notes: mergeQuotationNotes(selectedQuotation.notes, {
            final_approval: {
              note: 'تم الاعتماد النهائي وإنشاء عقد',
              by: formatUserName(profile?.full_name || profile?.email),
              at: new Date().toISOString()
            }
          })
        })
        .eq('id', selectedQuotation.id);

      if (quotError) throw quotError;

      // Create contract
      const contractNumber = `CT-${Date.now().toString().slice(-8)}`;
      const parsedQuotation = parseQuotationDescription(selectedQuotation.description);
      const quotationDetails = parsedQuotation.details || {};
      const contractNotes = JSON.stringify({
        plainNotes: parsedQuotation.plainDescription || '',
        details: {
          contract_type: 'supply_installation',
          links: {
            client_site_id: quotationDetails.links?.client_site_id || null
          },
          contract: {
            project_name: quotationDetails.project?.project_name || selectedQuotation.title || '',
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

      await notifyUsers(
        selectedQuotation.created_by ? [{ id: selectedQuotation.created_by }] : [],
        'تم اعتماد العرض وإنشاء عقد',
        `تم اعتماد العرض "${selectedQuotation.title}" وإنشاء العقد ${contractNumber}.`,
        'success',
        `/quotations/${selectedQuotation.id}`
      );

      // Optionally send a WhatsApp notification to the client after contract creation
      if (sendAfterCreate) {
        try {
          sendWhatsApp(selectedQuotation);
        } catch (e) {
          console.error('خطأ أثناء إرسال إشعار العميل:', e);
        }
      }

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

  async function remindManagers(quotation) {
    const managers = await fetchNotificationUsers(['admin', 'manager']);
    await notifyUsers(
      managers,
      'تذكير بمراجعة عرض سعر',
      `مندوب المبيعات يطلب مراجعة العرض "${quotation.title}" للعميل ${quotation.clients?.name || ''}.`,
      'warning',
      `/quotations/${quotation.id}`
    );
    alert('تم إرسال تذكير للمديرين.');
  }

  function remindClient(quotation) {
    sendWhatsApp(quotation);
  }

  function getStatusBadgeClass(status) {
    const map = {
      pending: 'badge-warning',
      accepted: 'badge-success',
      rejected: 'badge-danger',
      pending_manager: 'badge-warning',
      manager_approved: 'badge-success',
      manager_rejected: 'badge-danger',
      sent: 'badge-info',
      client_negotiating: 'badge-warning',
      client_accepted: 'badge-success',
      client_rejected: 'badge-danger',
      final_approved: 'badge-success',
      final_rejected: 'badge-danger'
    };
    return map[status] || 'badge-secondary';
  }

  // Play short notification sounds using Web Audio API.
  function playNotificationSound(type = 'default') {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const now = ctx.currentTime;

      if (type === 'accept') {
        // Success Chime: Uplifting major arpeggio (C5, E5, G5, C6)
        const playTone = (freq, startTime, duration, vol = 0.2) => {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          osc.connect(gainNode);
          gainNode.connect(ctx.destination);
          
          gainNode.gain.setValueAtTime(0, startTime);
          gainNode.gain.linearRampToValueAtTime(vol, startTime + 0.02);
          gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
          
          osc.start(startTime);
          osc.stop(startTime + duration);
        };
        playTone(523.25, now, 0.2);       // C5
        playTone(659.25, now + 0.1, 0.2); // E5
        playTone(783.99, now + 0.2, 0.4); // G5
        playTone(1046.50, now + 0.3, 0.6, 0.25); // C6
        setTimeout(() => ctx.close(), 1000);
        
      } else if (type === 'reject') {
        // Error Buzz: Attention-grabbing dual-tone descending drop
        const playBuzz = (freq1, freq2, startTime, duration) => {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.value = freq1;
          osc.frequency.exponentialRampToValueAtTime(freq2, startTime + duration);
          osc.connect(gainNode);
          gainNode.connect(ctx.destination);
          
          gainNode.gain.setValueAtTime(0, startTime);
          gainNode.gain.linearRampToValueAtTime(0.15, startTime + 0.02);
          gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
          
          osc.start(startTime);
          osc.stop(startTime + duration);
        };
        playBuzz(300, 150, now, 0.3);
        playBuzz(300, 150, now + 0.2, 0.4);
        setTimeout(() => ctx.close(), 700);

      } else if (type === 'negotiation') {
        // Notification Ping: Double clear bell
        const playPing = (freq, startTime, duration) => {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          osc.connect(gainNode);
          gainNode.connect(ctx.destination);
          
          gainNode.gain.setValueAtTime(0, startTime);
          gainNode.gain.linearRampToValueAtTime(0.25, startTime + 0.01);
          gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
          
          osc.start(startTime);
          osc.stop(startTime + duration);
        };
        playPing(880, now, 0.3);      // A5
        playPing(880, now + 0.15, 0.5); // A5 again
        setTimeout(() => ctx.close(), 800);

      } else {
        // Default short click
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 600;
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.1, now + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
        setTimeout(() => ctx.close(), 200);
      }
    } catch (e) {
      // AudioContext may be blocked; ignore silently
      console.error('Audio play error', e);
    }
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
        .filter(row => hasDetailValue(row.value))
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
          {Object.entries(QUOTATION_STATUS)
            .filter(([key]) => !['draft', 'pending', 'accepted', 'rejected'].includes(key))
            .map(([key, label]) => (
              <button
                key={key}
                className={`city-filter-btn ${statusFilter === key ? 'active' : ''}`}
                onClick={() => setStatusFilter(key)}
              >
                {label}
              </button>
            ))}
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
                    <span className={`badge ${getStatusBadgeClass(q.status)}`}>
                      {QUOTATION_STATUS[q.status] || q.status}
                    </span>
                    {parseQuotationNotes(q.notes).client_response && (() => {
                      const decision = parseQuotationNotes(q.notes).client_response.decision;
                      return (
                        <span style={{ marginRight: '12px' }} title={`رد العميل: ${decision}`}>
                          {decision === 'accepted' && <Check size={20} className="text-success" style={{ verticalAlign: 'middle' }} />}
                          {decision === 'rejected' && <X size={20} className="text-danger" style={{ verticalAlign: 'middle' }} />}
                          {decision === 'negotiating' && <MessageCircle size={20} className="text-warning" style={{ verticalAlign: 'middle' }} />}
                        </span>
                      );
                    })()}
                    {(parseQuotationNotes(q.notes).manager_response?.note || parseQuotationNotes(q.notes).manager_rejection?.note) && (
                      <span className="badge badge-secondary" style={{ marginLeft: '8px' }} title={parseQuotationNotes(q.notes).manager_response?.note || parseQuotationNotes(q.notes).manager_rejection?.note}>
                        ملاحظة المدير
                      </span>
                    )}
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
                      {(isAdmin || profile?.role === 'manager') && q.status === 'pending_manager' && (
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
                      {(isAdmin || profile?.role === 'manager') && ['client_accepted', 'client_negotiating', 'client_rejected'].includes(q.status) && (
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

                      {(isAdmin || profile?.role === 'sales_rep') && ['pending_manager', 'client_negotiating'].includes(q.status) && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => remindManagers(q)}
                          title="تذكير المدير"
                        >
                          <MessageCircle size={16} className="text-warning" />
                        </button>
                      )}

                      {(isAdmin || profile?.role === 'sales_rep') && ['sent', 'manager_approved'].includes(q.status) && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => remindClient(q)}
                          title="تذكير العميل"
                        >
                          <Send size={16} className="text-info" />
                        </button>
                      )}

                      {(isAdmin || profile?.role === 'sales_rep') && q.status === 'sent' && (
                        <>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleStatusChange(q, 'client_accepted')} title="العميل موافق">
                            <Check size={18} className="text-success" />
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleStatusChange(q, 'client_rejected')} title="العميل رافض">
                            <X size={18} className="text-danger" />
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleStatusChange(q, 'client_negotiating')} title="العميل تفاوض">
                            <MessageCircle size={18} className="text-warning" />
                          </button>
                        </>
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
                      onSelect={handleClientSelect}
                      onClear={handleClientClear}
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
                  <ClientSiteSelect
                    clientId={form.client_id}
                    value={form.client_site_id}
                    sites={clientSites}
                    onChange={handleClientSiteChange}
                    onSitesChange={handleClientSitesChange}
                  />
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
                              <div className="boolean-switch-field">
                                <input
                                  id={`quotation-${section.key}-${field}`}
                                  className="boolean-switch-input"
                                  type="checkbox"
                                  checked={isEnabledDetailValue(form.details?.[section.key]?.[field])}
                                  onChange={(e) => handleDetailChange(section.key, field, e.target.checked)}
                                />
                                <label className="boolean-switch" htmlFor={`quotation-${section.key}-${field}`}>
                                  <span className="boolean-switch-track">
                                    <span className="boolean-switch-icon boolean-switch-icon-on">✓</span>
                                    <span className="boolean-switch-icon boolean-switch-icon-off">✕</span>
                                    <span className="boolean-switch-thumb"></span>
                                  </span>
                                </label>
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
                <div className="form-group">
                  <label className="form-label">خيارات إضافية</label>
                  <div className="form-checkbox">
                    <input type="checkbox" id="sendAfterCreate" checked={sendAfterCreate} onChange={e => setSendAfterCreate(e.target.checked)} />
                    <label htmlFor="sendAfterCreate">إرسال إشعار/واتساب للعميل بعد إنشاء العقد</label>
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
                    <td><strong>{formatDetailValue(row.value)}</strong></td>
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
