import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, formatCurrency, formatDate, CITIES, QUOTATION_STATUS, PAYMENT_METHODS, logActivity } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { User, Phone, Mail, MapPin, Building2, FileText, DollarSign, Plus, ArrowRight, X, Calendar, MessageCircle, Navigation, Printer, Edit, Trash2 } from 'lucide-react';
import { notifyIntegrations, openGoogleMaps, openWhatsApp } from '../lib/integrations';

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
    return acc;
  }, {});
}

function ClientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('quotations');

  // PDF Printing state
  const [printActive, setPrintActive] = useState(false);

  function triggerPrintStatement() {
    setPrintActive(true);
    setTimeout(() => {
      window.print();
      setPrintActive(false);
    }, 300);
  }

  const getLedger = () => {
    const ledger = [];
    
    // 1. Add contracts (debit / due amount increase)
    contracts.forEach(c => {
      ledger.push({
        date: c.start_date,
        description: `إبرام عقد مصاعد رقم ${c.contract_number} (${c.service_type || ''})`,
        type: 'debit',
        amount: parseFloat(c.total_amount) || 0
      });
    });

    // 2. Add collections (credit / payment received)
    collections.forEach(col => {
      if (col.status === 'collected' || col.status === 'partial') {
        const amt = parseFloat(col.collected_amount) || 0;
        if (amt > 0) {
          ledger.push({
            date: col.collected_date || col.due_date,
            description: `سداد دفعة مالية مستحقة - رقم العقد ${col.contracts?.contract_number || ''}`,
            type: 'credit',
            amount: amt
          });
        }
      }
    });

    // 3. Add spare invoices (debit / due amount increase)
    spareInvoices.forEach(inv => {
      ledger.push({
        date: inv.created_at?.split('T')[0],
        description: `فاتورة بيع قطع غيار رقم ${inv.invoice_number} - ${inv.notes || ''}`,
        type: 'debit',
        amount: parseFloat(inv.total_amount) || 0
      });
    });

    // Sort by date ASC
    return ledger.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  // Tab data
  const [quotations, setQuotations] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [collections, setCollections] = useState([]);
  const [sites, setSites] = useState([]);
  const [spareInvoices, setSpareInvoices] = useState([]);
  const [services, setServices] = useState([]);

  // Stats
  const [totalDue, setTotalDue] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [activeContracts, setActiveContracts] = useState(0);

  // Add site modal
  const [showSiteModal, setShowSiteModal] = useState(false);
  const [editingSite, setEditingSite] = useState(null);
  const [savingSite, setSavingSite] = useState(false);
  const [quickModal, setQuickModal] = useState(null);
  const [savingQuick, setSavingQuick] = useState(false);
  const [payingCollection, setPayingCollection] = useState(null);
  const [quickForm, setQuickForm] = useState({
    title: '',
    service_id: '',
    service_type: 'تركيب مصاعد',
    amount: '',
    description: '',
    details: createEmptyQuotationDetails(),
    contract_type: 'maintenance',
    contract_id: '',
    contract_number: '',
    payment_frequency: 'one_time',
    payment_method: 'cash',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: '',
    due_date: new Date().toISOString().slice(0, 10),
    collected_amount: '',
    notes: ''
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_method: 'cash',
    collected_date: new Date().toISOString().slice(0, 10),
    notes: ''
  });
  const [siteForm, setSiteForm] = useState({
    site_name: '',
    address: '',
    city: 'mecca',
    elevator_count: 1,
    floor_count: '',
    elevator_type: '',
    responsible_name: '',
    responsible_phone: '',
    elevator_codes: [''],
    notes: ''
  });

  function parseContractNotes(notes) {
    if (!notes) return { plainNotes: '', details: {}, attachments: [] };
    try {
      const parsed = JSON.parse(notes);
      return {
        plainNotes: parsed.plainNotes || '',
        details: parsed.details || {},
        attachments: parsed.attachments || []
      };
    } catch {
      return { plainNotes: notes, details: {}, attachments: [] };
    }
  }

  function isMaintenanceContract(contract) {
    const meta = parseContractNotes(contract.notes);
    return meta.details?.contract_type === 'maintenance' || (contract.service_type || '').includes('صيانة');
  }

  function getSiteContracts(siteId) {
    return contracts
      .filter(contract => {
        const meta = parseContractNotes(contract.notes);
        return isMaintenanceContract(contract) &&
          contract.status === 'active' &&
          meta.details?.links?.client_site_id === siteId;
      })
      .map(contract => ({
        ...contract,
        meta: parseContractNotes(contract.notes),
        payments: collections.filter(item => item.contract_id === contract.id)
      }));
  }

  useEffect(() => {
    fetchClient();
    fetchAllTabData();
  }, [id]);

  async function fetchClient() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setClient(data);
    } catch (err) {
      console.error('خطأ في جلب بيانات العميل:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAllTabData() {
    await Promise.all([
      fetchQuotations(),
      fetchContracts(),
      fetchCollections(),
      fetchSites(),
      fetchSpareInvoices(),
      fetchServices()
    ]);
  }

  async function fetchQuotations() {
    try {
      const { data, error } = await supabase
        .from('quotations')
        .select('*')
        .eq('client_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setQuotations(data || []);
    } catch (err) {
      console.error('خطأ في جلب عروض الأسعار:', err);
    }
  }

  async function fetchContracts() {
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('client_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setContracts(data || []);
      const active = (data || []).filter(c => c.status === 'active').length;
      setActiveContracts(active);
    } catch (err) {
      console.error('خطأ في جلب العقود:', err);
    }
  }

  async function fetchCollections() {
    try {
      const { data, error } = await supabase
        .from('collection_schedule')
        .select('*, contracts(contract_number, title)')
        .eq('client_id', id)
        .order('due_date', { ascending: false });
      if (error) throw error;
      setCollections(data || []);

      let due = 0;
      let paid = 0;
      (data || []).forEach(c => {
        if (c.status === 'collected') {
          paid += (c.collected_amount || c.amount || 0);
        } else {
          due += (c.amount || 0) - (c.collected_amount || 0);
        }
      });
      setTotalDue(due);
      setTotalPaid(paid);
    } catch (err) {
      console.error('خطأ في جلب التحصيلات:', err);
    }
  }

  async function fetchSites() {
    try {
      const { data, error } = await supabase
        .from('client_sites')
        .select('*')
        .eq('client_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSites(data || []);
    } catch (err) {
      console.error('خطأ في جلب المواقع:', err);
    }
  }

  async function fetchSpareInvoices() {
    try {
      const { data, error } = await supabase
        .from('spare_parts_invoices')
        .select('*')
        .eq('client_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSpareInvoices(data || []);
    } catch (err) {
      console.error('خطأ في جلب فواتير قطع الغيار:', err);
    }
  }

  function normalizeElevatorCodes(codes) {
    if (Array.isArray(codes)) return codes.map(code => String(code || ''));
    if (typeof codes === 'string') {
      try {
        const parsed = JSON.parse(codes);
        if (Array.isArray(parsed)) return parsed.map(code => String(code || ''));
      } catch {
        return codes.split(',').map(code => code.trim()).filter(Boolean);
      }
    }
    return [];
  }

  function getSiteFormDefaults() {
    return {
      site_name: '',
      address: '',
      city: 'mecca',
      elevator_count: 1,
      floor_count: '',
      elevator_type: '',
      responsible_name: '',
      responsible_phone: '',
      elevator_codes: [''],
      notes: ''
    };
  }

  function handleSiteFormChange(field, value) {
    setSiteForm(prev => ({ ...prev, [field]: value }));
  }

  function handleElevatorCodeChange(index, value) {
    setSiteForm(prev => ({
      ...prev,
      elevator_codes: (prev.elevator_codes || ['']).map((code, i) => (i === index ? value : code))
    }));
  }

  function addElevatorCodeField() {
    setSiteForm(prev => ({
      ...prev,
      elevator_codes: [...(prev.elevator_codes || []), '']
    }));
  }

  function removeElevatorCodeField(index) {
    setSiteForm(prev => {
      const nextCodes = (prev.elevator_codes || []).filter((_, i) => i !== index);
      return { ...prev, elevator_codes: nextCodes.length ? nextCodes : [''] };
    });
  }

  function resetSiteForm() {
    setSiteForm(getSiteFormDefaults());
  }

  function openAddSiteModal() {
    setEditingSite(null);
    resetSiteForm();
    setShowSiteModal(true);
  }

  function openEditSiteModal(site) {
    const elevatorCodes = normalizeElevatorCodes(site.elevator_codes);
    setEditingSite(site);
    setSiteForm({
      site_name: site.site_name || '',
      address: site.address || '',
      city: site.city || 'mecca',
      elevator_count: site.elevator_count || 1,
      floor_count: site.floor_count || '',
      elevator_type: site.elevator_type || '',
      responsible_name: site.responsible_name || '',
      responsible_phone: site.responsible_phone || '',
      elevator_codes: elevatorCodes.length ? elevatorCodes : [''],
      notes: site.notes || ''
    });
    setShowSiteModal(true);
  }

  function closeSiteModal() {
    setShowSiteModal(false);
    setEditingSite(null);
    resetSiteForm();
  }

  async function handleSaveSite(e) {
    e.preventDefault();
    if (!siteForm.site_name) return;

    try {
      setSavingSite(true);
      const payload = {
        client_id: id,
        site_name: siteForm.site_name,
        address: siteForm.address || null,
        city: siteForm.city,
        elevator_count: parseInt(siteForm.elevator_count) || 1,
        floor_count: parseInt(siteForm.floor_count) || 0,
        elevator_type: siteForm.elevator_type || null,
        responsible_name: siteForm.responsible_name || null,
        responsible_phone: siteForm.responsible_phone || null,
        elevator_codes: (siteForm.elevator_codes || []).map(code => String(code).trim()).filter(Boolean),
        notes: siteForm.notes || null
      };

      const { data: savedSite, error } = editingSite
        ? await supabase.from('client_sites').update(payload).eq('id', editingSite.id).select().single()
        : await supabase.from('client_sites').insert(payload).select().single();

      if (error) throw error;

      await logActivity(
        profile?.id,
        profile?.full_name,
        editingSite ? 'تعديل مبنى' : 'إضافة مبنى',
        'client_sites',
        savedSite?.id || editingSite?.id,
        `${editingSite ? 'تم تعديل' : 'تم إضافة'} مبنى ${payload.site_name} للعميل ${client?.name || ''}`,
        payload.city
      );

      closeSiteModal();
      fetchSites();
    } catch (err) {
      console.error('خطأ في حفظ الموقع:', err);
      alert('حدث خطأ أثناء حفظ الموقع');
    } finally {
      setSavingSite(false);
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

  async function handleDeleteSite(site) {
    const linkedContracts = getSiteContracts(site.id);
    const message = linkedContracts.length > 0
      ? `هذا المبنى مشترك في عقد صيانة ساري. هل تريد حذف "${site.site_name}"؟`
      : `هل تريد حذف المبنى "${site.site_name}"؟`;

    if (!window.confirm(message)) return;

    try {
      const { error } = await supabase
        .from('client_sites')
        .delete()
        .eq('id', site.id);

      if (error) throw error;
      await logActivity(
        profile?.id,
        profile?.full_name,
        'حذف مبنى',
        'client_sites',
        site.id,
        `تم حذف مبنى ${site.site_name} للعميل ${client?.name || ''}`,
        site.city || client?.city
      );
      fetchSites();
    } catch (err) {
      console.error('خطأ في حذف الموقع:', err);
      alert('حدث خطأ أثناء حذف الموقع');
    }
  }

  function resetQuickForm(type = null) {
    const today = new Date().toISOString().slice(0, 10);
    setQuickForm({
      title: '',
      service_id: '',
      service_type: type === 'contract' ? 'صيانة مصاعد' : 'تركيب مصاعد',
      amount: '',
      description: '',
      details: createEmptyQuotationDetails(),
      contract_type: 'maintenance',
      contract_id: '',
      contract_number: '',
      payment_frequency: 'one_time',
      payment_method: 'cash',
      start_date: today,
      end_date: '',
      due_date: today,
      collected_amount: '',
      notes: ''
    });
  }

  function openQuickModal(type) {
    resetQuickForm(type);
    setQuickModal(type);
  }

  function buildQuickQuotationDescription() {
    return JSON.stringify({
      plainDescription: quickForm.description,
      details: quickForm.details || createEmptyQuotationDetails()
    });
  }

  function handleQuickQuotationDetailChange(section, field, value) {
    setQuickForm(prev => {
      const details = {
        ...(prev.details || createEmptyQuotationDetails()),
        [section]: {
          ...((prev.details || {})[section] || {}),
          [field]: value
        }
      };
      const next = { ...prev, details };

      if (section === 'financial' && (field === 'price_before_vat' || field === 'vat_amount')) {
        const price = parseFloat(details.financial?.price_before_vat) || 0;
        const vat = parseFloat(details.financial?.vat_amount) || 0;
        if (price || vat) next.amount = (price + vat).toFixed(2);
      }

      return next;
    });
  }

  function closeQuickModal() {
    setQuickModal(null);
    setSavingQuick(false);
  }

  async function generatePrefixedNumber(table, field, prefix) {
    const { data } = await supabase
      .from(table)
      .select(field)
      .order('created_at', { ascending: false })
      .limit(1);
    const last = data?.[0]?.[field] || '';
    const lastNum = parseInt(String(last).replace(prefix, ''), 10) || 0;
    return `${prefix}${String(lastNum + 1).padStart(5, '0')}`;
  }

  async function handleSaveQuick(e) {
    e.preventDefault();
    setSavingQuick(true);
    try {
      const branch = client.city || profile?.branch || 'mecca';
      const amount = parseFloat(quickForm.amount) || 0;

      if (quickModal === 'quotation') {
        const quotationNumber = await generatePrefixedNumber('quotations', 'quotation_number', 'QT');
        const selectedService = services.find(service => service.id === quickForm.service_id);
        const quotationPayload = {
          quotation_number: quotationNumber,
          client_id: id,
          service_id: quickForm.service_id || null,
          service_type: selectedService?.name || quickForm.service_type || quickForm.title,
          title: quickForm.title || quickForm.service_type,
          description: buildQuickQuotationDescription(),
          amount,
          status: 'pending',
          branch,
          notes: quickForm.notes,
          created_by: profile?.id
        };
        let { data: quotationData, error } = await supabase.from('quotations').insert(quotationPayload).select().single();
        if (error?.message?.includes('service_id')) {
          const { service_id, ...payloadWithoutServiceId } = quotationPayload;
          const fallback = await supabase.from('quotations').insert(payloadWithoutServiceId).select().single();
          quotationData = fallback.data;
          error = fallback.error;
        }
        if (error) throw error;
        await logActivity(
          profile?.id,
          profile?.full_name,
          'إضافة عرض سعر',
          'quotations',
          quotationData?.id,
          `تم إضافة عرض سعر ${quotationNumber} للعميل ${client?.name || ''} بقيمة ${formatCurrency(amount)}`,
          branch
        );
        await fetchQuotations();
        setActiveTab('quotations');
      }

      if (quickModal === 'contract') {
        const contractNumber = quickForm.contract_number || await generatePrefixedNumber('contracts', 'contract_number', 'CT');
        const notesPayload = JSON.stringify({
          plainNotes: quickForm.notes,
          details: {
            contract_type: quickForm.contract_type,
            created_from_client_profile: true
          }
        });
        const { data: contract, error } = await supabase.from('contracts').insert({
          contract_number: contractNumber,
          client_id: id,
          service_type: quickForm.service_type,
          title: quickForm.title || quickForm.service_type,
          total_amount: amount,
          payment_frequency: quickForm.payment_frequency,
          payment_method: quickForm.payment_method,
          installment_amount: amount,
          start_date: quickForm.start_date,
          end_date: quickForm.end_date || null,
          status: 'active',
          branch,
          notes: notesPayload,
          created_by: profile?.id
        }).select().single();
        if (error) throw error;

        if (amount > 0) {
          const { error: scheduleError } = await supabase.from('collection_schedule').insert({
            contract_id: contract.id,
            client_id: id,
            due_date: quickForm.due_date || quickForm.start_date,
            amount,
            collected_amount: 0,
            status: 'pending',
            payment_method: quickForm.payment_method,
            notes: 'دفعة عقد',
            branch
          });
          if (scheduleError) throw scheduleError;
        }
        await logActivity(
          profile?.id,
          profile?.full_name,
          'إضافة عقد',
          'contracts',
          contract.id,
          `تم إضافة عقد ${contractNumber} للعميل ${client?.name || ''} بقيمة ${formatCurrency(amount)}`,
          branch
        );
        await Promise.all([fetchContracts(), fetchCollections()]);
        setActiveTab('contracts');
      }

      if (quickModal === 'collection') {
        const collectedAmount = parseFloat(quickForm.collected_amount) || 0;
        const status = collectedAmount >= amount ? 'collected' : (collectedAmount > 0 ? 'partial' : 'pending');
        const { data: schedule, error } = await supabase.from('collection_schedule').insert({
          contract_id: quickForm.contract_id || null,
          client_id: id,
          due_date: quickForm.due_date,
          amount,
          collected_amount: collectedAmount,
          collected_date: quickForm.collected_amount ? new Date().toISOString().slice(0, 10) : null,
          payment_method: quickForm.payment_method,
          status,
          notes: quickForm.notes || 'تحصيل سابق/دفعة مضافة من ملف العميل',
          branch
        }).select().single();
        if (error) throw error;
        if (collectedAmount > 0) {
          const { error: collectionError } = await supabase.from('collections').insert({
            schedule_id: schedule.id,
            contract_id: quickForm.contract_id || null,
            client_id: id,
            amount: collectedAmount,
            payment_method: quickForm.payment_method,
            collection_date: new Date().toISOString().slice(0, 10),
            notes: quickForm.notes || 'تحصيل سابق/دفعة مضافة من ملف العميل',
            branch,
            collected_by: profile?.id,
            collected_by_name: profile?.full_name
          });
          if (collectionError) throw collectionError;
          await notifyIntegrations({
            title: 'تحصيل جديد من ملف العميل',
            message: `تم تسجيل تحصيل من ${client?.name || 'عميل'} بقيمة ${formatCurrency(collectedAmount)}`,
            actor: profile?.full_name || profile?.email,
            amount: formatCurrency(collectedAmount),
            branch: CITIES[branch] || branch,
            lines: [
              quickForm.contract_id ? `العقد: ${contracts.find(contract => contract.id === quickForm.contract_id)?.contract_number || quickForm.contract_id}` : 'بدون عقد مرتبط',
              `طريقة الدفع: ${PAYMENT_METHODS[quickForm.payment_method] || quickForm.payment_method}`,
              quickForm.notes ? `ملاحظات: ${quickForm.notes}` : ''
            ].filter(Boolean),
            link: `/clients/${id}`,
            whatsapp: true
          });
        }
        await logActivity(
          profile?.id,
          profile?.full_name,
          collectedAmount > 0 ? 'تسجيل تحصيل' : 'إضافة استحقاق',
          'collections',
          schedule.id,
          `${collectedAmount > 0 ? 'تم تسجيل تحصيل' : 'تم إضافة استحقاق'} للعميل ${client?.name || ''} بقيمة ${formatCurrency(collectedAmount > 0 ? collectedAmount : amount)}`,
          branch
        );
        await fetchCollections();
        setActiveTab('collections');
      }

      closeQuickModal();
    } catch (err) {
      console.error('Error saving client quick action:', err);
      alert(`حدث خطأ أثناء الحفظ: ${err.message || 'خطأ غير معروف'}`);
    } finally {
      setSavingQuick(false);
    }
  }

  function openPayCollection(collection) {
    const remaining = Math.max((parseFloat(collection.amount) || 0) - (parseFloat(collection.collected_amount) || 0), 0);
    setPayingCollection(collection);
    setPaymentForm({
      amount: remaining ? String(remaining) : '',
      payment_method: collection.payment_method || 'cash',
      collected_date: new Date().toISOString().slice(0, 10),
      notes: ''
    });
  }

  async function handlePayCollection(e) {
    e.preventDefault();
    if (!payingCollection) return;
    setSavingQuick(true);
    try {
      const paidNow = parseFloat(paymentForm.amount) || 0;
      const previousPaid = parseFloat(payingCollection.collected_amount) || 0;
      const newPaid = previousPaid + paidNow;
      const amount = parseFloat(payingCollection.amount) || 0;
      const status = newPaid >= amount ? 'collected' : 'partial';

      const { error: updateError } = await supabase
        .from('collection_schedule')
        .update({
          collected_amount: newPaid,
          collected_date: paymentForm.collected_date,
          payment_method: paymentForm.payment_method,
          status,
          notes: paymentForm.notes || payingCollection.notes
        })
        .eq('id', payingCollection.id);
      if (updateError) throw updateError;

      const { error: collectionError } = await supabase.from('collections').insert({
        schedule_id: payingCollection.id,
        contract_id: payingCollection.contract_id,
        client_id: id,
        amount: paidNow,
        payment_method: paymentForm.payment_method,
        collection_date: paymentForm.collected_date,
        notes: paymentForm.notes,
        branch: payingCollection.branch || client.city || 'mecca',
        collected_by: profile?.id,
        collected_by_name: profile?.full_name
      });
      if (collectionError) throw collectionError;

      await logActivity(
        profile?.id,
        profile?.full_name,
        'تسجيل تحصيل',
        'collections',
        payingCollection.id,
        `تم تسجيل تحصيل ${formatCurrency(paidNow)} من العميل ${client?.name || ''}`,
        payingCollection.branch || client.city || 'mecca'
      );

      await notifyIntegrations({
        title: 'تحصيل جديد من ملف العميل',
        message: `تم تسجيل تحصيل من ${client?.name || 'عميل'} بقيمة ${formatCurrency(paidNow)}`,
        actor: profile?.full_name || profile?.email,
        amount: formatCurrency(paidNow),
        branch: CITIES[payingCollection.branch || client.city || 'mecca'] || payingCollection.branch || client.city,
        lines: [
          payingCollection.contracts?.contract_number ? `العقد: ${payingCollection.contracts.contract_number}` : '',
          `طريقة الدفع: ${PAYMENT_METHODS[paymentForm.payment_method] || paymentForm.payment_method}`,
          paymentForm.notes ? `ملاحظات: ${paymentForm.notes}` : ''
        ].filter(Boolean),
        link: `/clients/${id}`,
        whatsapp: true
      });

      setPayingCollection(null);
      await fetchCollections();
      setActiveTab('collections');
    } catch (err) {
      console.error('Error paying collection:', err);
      alert(`حدث خطأ أثناء تسجيل الدفع: ${err.message || 'خطأ غير معروف'}`);
    } finally {
      setSavingQuick(false);
    }
  }

  function getStatusBadge(status) {
    const map = {
      pending: 'badge-warning',
      accepted: 'badge-success',
      rejected: 'badge-danger',
      active: 'badge-success',
      completed: 'badge-info',
      cancelled: 'badge-danger',
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
      active: 'نشط',
      completed: 'منتهي',
      cancelled: 'ملغي',
      collected: 'محصل',
      overdue: 'متأخر',
      partial: 'جزئي'
    };
    return map[status] || status;
  }

  function contactClient() {
    openWhatsApp(client?.phone, `مرحباً ${client?.name || ''}، معكم شركة عاصمة الكون.`);
  }

  function openClientMap() {
    openGoogleMaps(client?.address || `${client?.name || ''} ${CITIES[client?.city] || ''}`);
  }

  const tabs = [
    { key: 'quotations', label: 'عروض الأسعار' },
    { key: 'contracts', label: 'العقود' },
    { key: 'collections', label: 'التحصيلات' },
    { key: 'sites', label: 'المواقع' },
    { key: 'spares', label: 'فواتير قطع الغيار' }
  ];

  if (loading) {
    return (
      <div className="loading-inline">
        <div className="loader"></div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="empty-state">
        <h3>العميل غير موجود</h3>
        <button className="btn btn-primary mt-16" onClick={() => navigate('/clients')}>
          <ArrowRight size={18} />
          العودة للعملاء
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Back Button */}
      <button className="btn btn-ghost mb-24" onClick={() => navigate('/clients')}>
        <ArrowRight size={18} />
        العودة للعملاء
      </button>

      {/* Profile Header */}
      <div className="profile-header">
        <div className="profile-avatar">
          {client.name ? client.name.charAt(0) : '؟'}
        </div>
        <div className="profile-info">
          <h2 className="profile-name">{client.name}</h2>
          <div className="profile-meta">
            {client.phone && (
              <span className="profile-meta-item">
                <Phone size={16} />
                {client.phone}
              </span>
            )}
            {client.email && (
              <span className="profile-meta-item">
                <Mail size={16} />
                {client.email}
              </span>
            )}
            {client.city && (
              <span className="profile-meta-item">
                <MapPin size={16} />
                {CITIES[client.city] || client.city}
              </span>
            )}
            {client.address && (
              <span className="profile-meta-item">
                <Building2 size={16} />
                {client.address}
              </span>
            )}
          </div>
        </div>
        <div className="profile-stats">
          <div className="profile-stat">
            <div className="profile-stat-value text-danger">{formatCurrency(totalDue)}</div>
            <div className="profile-stat-label">المستحقات</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat-value text-success">{formatCurrency(totalPaid)}</div>
            <div className="profile-stat-label">المحصل</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat-value text-primary">{activeContracts}</div>
            <div className="profile-stat-label">العقود النشطة</div>
          </div>
        </div>
        <div className="profile-actions">
          <button className="btn btn-whatsapp btn-sm" onClick={contactClient} disabled={!client.phone}>
            <MessageCircle size={16} />
            واتساب
          </button>
          <button className="btn btn-secondary btn-sm" onClick={openClientMap} disabled={!client.address && !client.city}>
            <Navigation size={16} />
            الخريطة
          </button>
          <button className="btn btn-secondary btn-sm" onClick={triggerPrintStatement}>
            <Printer size={16} />
            كشف الحساب (PDF)
          </button>
        </div>
      </div>

      <div className="card mb-24">
        <div className="card-body">
          <div className="flex-between">
            <div>
              <h3 className="font-bold">إجراءات سريعة على العميل</h3>
              <p className="text-muted mt-8">أضيفي عرض سعر، عقد، أو دفعة مباشرة من ملف العميل</p>
            </div>
            <div className="flex gap-8">
              <button className="btn btn-secondary" onClick={() => openQuickModal('quotation')}>
                <Plus size={16} />
                إضافة عرض سعر
              </button>
              <button className="btn btn-secondary" onClick={() => openQuickModal('contract')}>
                <Plus size={16} />
                إضافة عقد
              </button>
              <button className="btn btn-primary" onClick={() => openQuickModal('collection')}>
                <DollarSign size={16} />
                إضافة دفعة/استحقاق
              </button>
              <button className="btn btn-secondary" onClick={() => navigate(`/spare-parts/invoice?client_id=${id}`)}>
                <FileText size={16} />
                فاتورة قطع
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="card">
        <div className="card-body">
          {/* ===== Quotations Tab ===== */}
          {activeTab === 'quotations' && (
            <>
              {quotations.length === 0 ? (
                <div className="empty-state">
                  <FileText size={48} />
                  <h3>لا توجد عروض أسعار</h3>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>رقم العرض</th>
                        <th>العنوان</th>
                        <th>المبلغ</th>
                        <th>الحالة</th>
                        <th>التاريخ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotations.map(q => (
                        <tr key={q.id} className="clickable" onClick={() => navigate(`/quotations/${q.id}`)}>
                          <td>{q.quotation_number || q.id?.slice(0, 8)}</td>
                          <td>{q.title || '-'}</td>
                          <td>{formatCurrency(q.amount)}</td>
                          <td>
                            <span className={`badge ${getStatusBadge(q.status)}`}>
                              {getStatusText(q.status)}
                            </span>
                          </td>
                          <td>{formatDate(q.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ===== Contracts Tab ===== */}
          {activeTab === 'contracts' && (
            <>
              {contracts.length === 0 ? (
                <div className="empty-state">
                  <FileText size={48} />
                  <h3>لا توجد عقود</h3>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>رقم العقد</th>
                        <th>القيمة</th>
                        <th>تاريخ البداية</th>
                        <th>تاريخ النهاية</th>
                        <th>الحالة</th>
                        <th>طريقة الدفع</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contracts.map(c => (
                        <tr key={c.id}>
                          <td>{c.contract_number || c.id?.slice(0, 8)}</td>
                          <td>{formatCurrency(c.total_amount)}</td>
                          <td>{formatDate(c.start_date)}</td>
                          <td>{formatDate(c.end_date)}</td>
                          <td>
                            <span className={`badge ${getStatusBadge(c.status)}`}>
                              {getStatusText(c.status)}
                            </span>
                          </td>
                          <td>{PAYMENT_METHODS[c.payment_method] || c.payment_method || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ===== Collections Tab ===== */}
          {activeTab === 'collections' && (
            <>
              {collections.length === 0 ? (
                <div className="empty-state">
                  <DollarSign size={48} />
                  <h3>لا توجد تحصيلات</h3>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>تاريخ الاستحقاق</th>
                        <th>المبلغ</th>
                        <th>المبلغ المحصل</th>
                        <th>الحالة</th>
                        <th>تاريخ التحصيل</th>
                        <th>طريقة الدفع</th>
                        <th>إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {collections.map(c => (
                        <tr key={c.id}>
                          <td>
                            <span className="flex gap-8">
                              <Calendar size={16} className="text-muted" />
                              {formatDate(c.due_date)}
                            </span>
                          </td>
                          <td>{formatCurrency(c.amount)}</td>
                          <td>{formatCurrency(c.collected_amount || 0)}</td>
                          <td>
                            <span className={`badge ${getStatusBadge(c.status)}`}>
                              {getStatusText(c.status)}
                            </span>
                          </td>
                          <td>{c.collected_date ? formatDate(c.collected_date) : '-'}</td>
                          <td>{PAYMENT_METHODS[c.payment_method] || c.payment_method || '-'}</td>
                          <td>
                            {c.status !== 'collected' ? (
                              <button className="btn btn-primary btn-sm" onClick={() => openPayCollection(c)}>
                                دفع
                              </button>
                            ) : (
                              <span className="text-muted">مدفوع</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ===== Sites Tab ===== */}
          {activeTab === 'sites' && (
            <>
              <div className="flex-between mb-24">
                <h3 className="font-bold">المواقع ({sites.length})</h3>
                <button className="btn btn-primary btn-sm" onClick={openAddSiteModal}>
                  <Plus size={16} />
                  إضافة موقع
                </button>
              </div>
              {sites.length === 0 ? (
                <div className="empty-state">
                  <Building2 size={48} />
                  <h3>لا توجد مواقع</h3>
                  <p>أضف مواقع العميل التي تحتوي على المصاعد</p>
                </div>
              ) : (
                <div className="grid-2">
                  {sites.map(site => {
                    const maintenanceContracts = getSiteContracts(site.id);
                    const activeMaintenance = maintenanceContracts[0];
                    const visits = activeMaintenance?.meta?.details?.visits || {};
                    const sla = activeMaintenance?.meta?.details?.sla || {};
                    const paidAmount = activeMaintenance?.payments.reduce((sum, item) => sum + (parseFloat(item.collected_amount) || 0), 0) || 0;
                    const remainingAmount = activeMaintenance
                      ? (parseFloat(activeMaintenance.total_amount) || 0) - paidAmount
                      : 0;
                    const elevatorCodes = normalizeElevatorCodes(site.elevator_codes).filter(Boolean);

                    return (
                    <div key={site.id} className="card">
                      <div className="card-body">
                        <div className="flex-between mb-16">
                          <div className="flex gap-8" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                            <h4 className="font-bold">{site.site_name}</h4>
                            {activeMaintenance && (
                              <span className="badge badge-success">
                                مشترك صيانة
                              </span>
                            )}
                          </div>
                          <div className="flex gap-8">
                            <button className="btn btn-ghost btn-sm" onClick={() => openEditSiteModal(site)} title="تعديل المبنى">
                              <Edit size={14} />
                            </button>
                            <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDeleteSite(site)} title="حذف المبنى">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        <div className="flex gap-8 mb-16">
                          <MapPin size={16} className="text-muted" />
                          <span className="text-muted">{site.address || '-'}</span>
                        </div>
                        {site.address && (
                          <button className="btn btn-secondary btn-sm mb-16" onClick={() => openGoogleMaps(site.address)}>
                            <Navigation size={14} />
                            فتح الموقع
                          </button>
                        )}
                        <div className="flex gap-16">
                          <span className={`badge ${site.city === 'mecca' ? 'badge-info' : 'badge-primary'}`}>
                            {CITIES[site.city] || site.city}
                          </span>
                          <span className="badge badge-secondary">
                            {site.elevator_count || 0} مصعد
                          </span>
                          {!!site.floor_count && (
                            <span className="badge badge-secondary">
                              {site.floor_count} دور
                            </span>
                          )}
                          {site.elevator_type && (
                            <span className="badge badge-warning">
                              {site.elevator_type}
                            </span>
                          )}
                        </div>
                        <div className="form-row-3 mt-16">
                          <div>
                            <span className="form-label">العميل الأساسي</span>
                            <p className="font-bold">{client?.name || '-'}</p>
                          </div>
                          <div>
                            <span className="form-label">رقم العميل</span>
                            <p className="font-bold">{client?.phone || '-'}</p>
                          </div>
                          <div>
                            <span className="form-label">مسؤول المبنى</span>
                            <p className="font-bold">
                              {site.responsible_name || '-'}
                              {site.responsible_phone ? ` - ${site.responsible_phone}` : ''}
                            </p>
                          </div>
                        </div>
                        {elevatorCodes.length > 0 && (
                          <div className="mt-16">
                            <span className="form-label">أكواد المصاعد</span>
                            <div className="flex gap-8 mt-8" style={{ flexWrap: 'wrap' }}>
                              {elevatorCodes.map((code, index) => (
                                <span key={`${site.id}-code-${index}`} className="badge badge-info">
                                  {code}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {site.notes && (
                          <p className="text-muted mt-16">{site.notes}</p>
                        )}

                        {activeMaintenance && (
                          <div className="mt-24" style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                            <h4 className="font-semibold mb-16">تفاصيل عقد الصيانة</h4>
                            <div className="form-row-3">
                              <div>
                                <span className="form-label">رقم العقد</span>
                                <p className="font-bold">{activeMaintenance.contract_number || '-'}</p>
                              </div>
                              <div>
                                <span className="form-label">تاريخ البداية</span>
                                <p className="font-bold">{formatDate(activeMaintenance.start_date)}</p>
                              </div>
                              <div>
                                <span className="form-label">تاريخ الانتهاء / التجديد</span>
                                <p className="font-bold">{formatDate(activeMaintenance.end_date)}</p>
                              </div>
                            </div>

                            <div className="form-row-3">
                              <div>
                                <span className="form-label">قيمة العقد</span>
                                <p className="font-bold">{formatCurrency(activeMaintenance.total_amount)}</p>
                              </div>
                              <div>
                                <span className="form-label">المحصل</span>
                                <p className="font-bold text-success">{formatCurrency(paidAmount)}</p>
                              </div>
                              <div>
                                <span className="form-label">المتبقي</span>
                                <p className="font-bold text-danger">{formatCurrency(remainingAmount > 0 ? remainingAmount : 0)}</p>
                              </div>
                            </div>

                            <div className="form-row-3">
                              <div>
                                <span className="form-label">الزيارات الشهرية</span>
                                <p className="font-bold">{visits.monthly_visits || '-'}</p>
                              </div>
                              <div>
                                <span className="form-label">الزيارات الربع سنوية</span>
                                <p className="font-bold">{visits.quarterly_visits || '-'}</p>
                              </div>
                              <div>
                                <span className="form-label">الزيارة السنوية</span>
                                <p className="font-bold">{visits.annual_visit || '-'}</p>
                              </div>
                            </div>

                            {(sla.failure_response_time || sla.emergency_response_time || sla.working_hours) && (
                              <div className="form-row-3">
                                <div>
                                  <span className="form-label">زمن الأعطال</span>
                                  <p className="font-bold">{sla.failure_response_time || '-'}</p>
                                </div>
                                <div>
                                  <span className="form-label">زمن الطوارئ</span>
                                  <p className="font-bold">{sla.emergency_response_time || '-'}</p>
                                </div>
                                <div>
                                  <span className="form-label">أوقات العمل</span>
                                  <p className="font-bold">{sla.working_hours || '-'}</p>
                                </div>
                              </div>
                            )}

                            {activeMaintenance.payments.length > 0 && (
                              <div className="table-container mt-16">
                                <table className="data-table">
                                  <thead>
                                    <tr>
                                      <th>الدفعة</th>
                                      <th>تاريخ الاستحقاق</th>
                                      <th>المبلغ</th>
                                      <th>المحصل</th>
                                      <th>الحالة</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {activeMaintenance.payments.map(payment => (
                                      <tr key={payment.id}>
                                        <td>{payment.notes || '-'}</td>
                                        <td>{formatDate(payment.due_date)}</td>
                                        <td>{formatCurrency(payment.amount)}</td>
                                        <td>{formatCurrency(payment.collected_amount || 0)}</td>
                                        <td>
                                          <span className={`badge ${getStatusBadge(payment.status)}`}>
                                            {getStatusText(payment.status)}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ===== Spare Parts Invoices Tab ===== */}
          {activeTab === 'spares' && (
            <>
              {spareInvoices.length === 0 ? (
                <div className="empty-state">
                  <FileText size={48} />
                  <h3>لا توجد فواتير قطع غيار</h3>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>رقم الفاتورة</th>
                        <th>الوصف</th>
                        <th>المبلغ</th>
                        <th>الحالة</th>
                        <th>التاريخ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spareInvoices.map(inv => (
                        <tr key={inv.id} className="clickable" onClick={() => navigate(`/spare-parts/invoices/${inv.id}`)}>
                          <td>{inv.invoice_number || inv.id?.slice(0, 8)}</td>
                          <td>{inv.notes || '-'}</td>
                          <td>{formatCurrency(inv.total_amount)}</td>
                          <td>
                            <span className={`badge ${getStatusBadge(inv.status)}`}>
                              {getStatusText(inv.status)}
                            </span>
                          </td>
                          <td>{formatDate(inv.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {quickModal && (
        <div className="modal-overlay" onClick={closeQuickModal}>
          <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {quickModal === 'quotation' && 'إضافة عرض سعر للعميل'}
                {quickModal === 'contract' && 'إضافة عقد للعميل'}
                {quickModal === 'collection' && 'إضافة دفعة أو استحقاق قديم'}
              </h2>
              <button className="modal-close" onClick={closeQuickModal}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveQuick}>
              <div className="modal-body">
                {(quickModal === 'quotation' || quickModal === 'contract') && (
                  <>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">العنوان *</label>
                        <input
                          className="form-input"
                          value={quickForm.title}
                          onChange={(e) => setQuickForm({ ...quickForm, title: e.target.value })}
                          placeholder="مثال: عرض توريد وتركيب مصعد"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">نوع الخدمة *</label>
                        {quickModal === 'quotation' ? (
                          <select
                            className="form-select"
                            value={quickForm.service_id}
                            onChange={(e) => {
                              const selectedService = services.find(service => service.id === e.target.value);
                              setQuickForm({
                                ...quickForm,
                                service_id: e.target.value,
                                service_type: selectedService?.name || quickForm.service_type
                              });
                            }}
                          >
                            <option value="">اختر الخدمة</option>
                            {services.map(service => (
                              <option key={service.id} value={service.id}>{service.name}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            className="form-input"
                            value={quickForm.service_type}
                            onChange={(e) => setQuickForm({ ...quickForm, service_type: e.target.value })}
                            required
                          />
                        )}
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">القيمة *</label>
                        <input
                          type="number"
                          className="form-input"
                          value={quickForm.amount}
                          onChange={(e) => setQuickForm({ ...quickForm, amount: e.target.value })}
                          min="0"
                          step="0.01"
                          required
                        />
                      </div>
                      {quickModal === 'contract' && (
                        <div className="form-group">
                          <label className="form-label">نوع العقد</label>
                          <select
                            className="form-select"
                            value={quickForm.contract_type}
                            onChange={(e) => setQuickForm({
                              ...quickForm,
                              contract_type: e.target.value,
                              service_type: e.target.value === 'maintenance' ? 'صيانة مصاعد' : 'توريد وتركيب مصاعد'
                            })}
                          >
                            <option value="maintenance">عقد صيانة</option>
                            <option value="supply_install">توريد وتركيب</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {quickModal === 'quotation' && (
                  <>
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
                                <input
                                  type={type}
                                  className="form-input"
                                  value={quickForm.details?.[section.key]?.[field] || ''}
                                  onChange={(e) => handleQuickQuotationDetailChange(section.key, field, e.target.value)}
                                  min={type === 'number' ? '0' : undefined}
                                  step={type === 'number' ? '0.01' : undefined}
                                />
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
                        value={quickForm.description}
                        onChange={(e) => setQuickForm({ ...quickForm, description: e.target.value })}
                        placeholder="أي شروط أو ملاحظات إضافية..."
                        rows={4}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">ملاحظات</label>
                      <textarea
                        className="form-textarea"
                        value={quickForm.notes}
                        onChange={(e) => setQuickForm({ ...quickForm, notes: e.target.value })}
                        rows={3}
                      />
                    </div>
                  </>
                )}

                {quickModal === 'contract' && (
                  <>
                    <div className="form-row-3">
                      <div className="form-group">
                        <label className="form-label">تاريخ البداية *</label>
                        <input
                          type="date"
                          className="form-input"
                          value={quickForm.start_date}
                          onChange={(e) => setQuickForm({ ...quickForm, start_date: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">تاريخ النهاية/التجديد</label>
                        <input
                          type="date"
                          className="form-input"
                          value={quickForm.end_date}
                          onChange={(e) => setQuickForm({ ...quickForm, end_date: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">استحقاق أول دفعة</label>
                        <input
                          type="date"
                          className="form-input"
                          value={quickForm.due_date}
                          onChange={(e) => setQuickForm({ ...quickForm, due_date: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">طريقة الدفع</label>
                        <select
                          className="form-select"
                          value={quickForm.payment_method}
                          onChange={(e) => setQuickForm({ ...quickForm, payment_method: e.target.value })}
                        >
                          {Object.entries(PAYMENT_METHODS).map(([key, val]) => (
                            <option key={key} value={key}>{val}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">دورية الدفع</label>
                        <select
                          className="form-select"
                          value={quickForm.payment_frequency}
                          onChange={(e) => setQuickForm({ ...quickForm, payment_frequency: e.target.value })}
                        >
                          <option value="one_time">دفعة واحدة</option>
                          <option value="monthly">شهري</option>
                          <option value="quarterly">ربع سنوي</option>
                          <option value="semi_annual">نصف سنوي</option>
                          <option value="annual">سنوي</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">ملاحظات العقد</label>
                      <textarea
                        className="form-textarea"
                        value={quickForm.notes}
                        onChange={(e) => setQuickForm({ ...quickForm, notes: e.target.value })}
                        rows={3}
                      />
                    </div>
                  </>
                )}

                {quickModal === 'collection' && (
                  <>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">العقد المرتبط</label>
                        <select
                          className="form-select"
                          value={quickForm.contract_id}
                          onChange={(e) => setQuickForm({ ...quickForm, contract_id: e.target.value })}
                        >
                          <option value="">بدون ربط عقد</option>
                          {contracts.map(contract => (
                            <option key={contract.id} value={contract.id}>
                              {contract.contract_number || contract.title || contract.id.slice(0, 8)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">تاريخ الاستحقاق *</label>
                        <input
                          type="date"
                          className="form-input"
                          value={quickForm.due_date}
                          onChange={(e) => setQuickForm({ ...quickForm, due_date: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">قيمة الاستحقاق *</label>
                        <input
                          type="number"
                          className="form-input"
                          value={quickForm.amount}
                          onChange={(e) => setQuickForm({ ...quickForm, amount: e.target.value })}
                          min="0"
                          step="0.01"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">المدفوع فعليًا</label>
                        <input
                          type="number"
                          className="form-input"
                          value={quickForm.collected_amount}
                          onChange={(e) => setQuickForm({ ...quickForm, collected_amount: e.target.value })}
                          min="0"
                          step="0.01"
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">طريقة الدفع</label>
                        <select
                          className="form-select"
                          value={quickForm.payment_method}
                          onChange={(e) => setQuickForm({ ...quickForm, payment_method: e.target.value })}
                        >
                          {Object.entries(PAYMENT_METHODS).map(([key, val]) => (
                            <option key={key} value={key}>{val}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">ملاحظات</label>
                        <input
                          className="form-input"
                          value={quickForm.notes}
                          onChange={(e) => setQuickForm({ ...quickForm, notes: e.target.value })}
                          placeholder="مثال: دفعة قديمة قبل استخدام النظام"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button type="submit" className="btn btn-primary" disabled={savingQuick}>
                  {savingQuick ? 'جاري الحفظ...' : 'حفظ'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={closeQuickModal}>
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {payingCollection && (
        <div className="modal-overlay" onClick={() => setPayingCollection(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">تسجيل دفع دفعة مستحقة</h2>
              <button className="modal-close" onClick={() => setPayingCollection(null)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handlePayCollection}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">المبلغ المدفوع *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">تاريخ الدفع</label>
                    <input
                      type="date"
                      className="form-input"
                      value={paymentForm.collected_date}
                      onChange={(e) => setPaymentForm({ ...paymentForm, collected_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">طريقة الدفع</label>
                    <select
                      className="form-select"
                      value={paymentForm.payment_method}
                      onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                    >
                      {Object.entries(PAYMENT_METHODS).map(([key, val]) => (
                        <option key={key} value={key}>{val}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">ملاحظات</label>
                    <input
                      className="form-input"
                      value={paymentForm.notes}
                      onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="submit" className="btn btn-primary" disabled={savingQuick}>
                  {savingQuick ? 'جاري التسجيل...' : 'تسجيل الدفع'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setPayingCollection(null)}>
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Site Modal */}
      {showSiteModal && (
        <div className="modal-overlay" onClick={closeSiteModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingSite ? 'تعديل بيانات المبنى' : 'إضافة موقع جديد'}</h2>
              <button className="modal-close" onClick={closeSiteModal}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveSite}>
              <div className="modal-body">
                <div className="card mb-24">
                  <div className="card-header">
                    <h3 className="card-title">بيانات العميل الأساسية</h3>
                  </div>
                  <div className="card-body">
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">اسم العميل الأساسي</label>
                        <input
                          type="text"
                          className="form-input"
                          value={client?.name || ''}
                          readOnly
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">رقم العميل الأساسي</label>
                        <input
                          type="text"
                          className="form-input"
                          value={client?.phone || ''}
                          readOnly
                        />
                      </div>
                    </div>
                    <p className="text-muted" style={{ margin: 0 }}>هذه البيانات من ملف العميل ولا يتم تعديلها من بيانات المبنى.</p>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">اسم الموقع *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={siteForm.site_name}
                    onChange={(e) => handleSiteFormChange('site_name', e.target.value)}
                    placeholder="مثال: برج الصفا"
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">العنوان</label>
                    <input
                      type="text"
                      className="form-input"
                      value={siteForm.address}
                      onChange={(e) => handleSiteFormChange('address', e.target.value)}
                      placeholder="عنوان الموقع"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">المدينة</label>
                    <select
                      className="form-select"
                      value={siteForm.city}
                      onChange={(e) => handleSiteFormChange('city', e.target.value)}
                    >
                      <option value="mecca">مكة المكرمة</option>
                      <option value="jeddah">جدة</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">اسم مسؤول المبنى</label>
                    <input
                      type="text"
                      className="form-input"
                      value={siteForm.responsible_name}
                      onChange={(e) => handleSiteFormChange('responsible_name', e.target.value)}
                      placeholder="اسم الشخص المسؤول في المبنى"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">رقم مسؤول المبنى</label>
                    <input
                      type="text"
                      className="form-input"
                      value={siteForm.responsible_phone}
                      onChange={(e) => handleSiteFormChange('responsible_phone', e.target.value)}
                      placeholder="رقم التواصل مع مسؤول المبنى"
                    />
                  </div>
                </div>

                <div className="form-row-3">
                  <div className="form-group">
                    <label className="form-label">عدد المصاعد</label>
                    <input
                      type="number"
                      className="form-input"
                      value={siteForm.elevator_count}
                      onChange={(e) => handleSiteFormChange('elevator_count', e.target.value)}
                      min="1"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">عدد الأدوار بالمبنى</label>
                    <input
                      type="number"
                      className="form-input"
                      value={siteForm.floor_count}
                      onChange={(e) => handleSiteFormChange('floor_count', e.target.value)}
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">نوع المصعد</label>
                    <input
                      type="text"
                      className="form-input"
                      value={siteForm.elevator_type}
                      onChange={(e) => handleSiteFormChange('elevator_type', e.target.value)}
                      placeholder="مثال: ركاب / بضائع"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <div className="flex-between mb-8">
                    <label className="form-label" style={{ margin: 0 }}>أكواد المصاعد بالمبنى</label>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={addElevatorCodeField}>
                      <Plus size={14} />
                      إضافة كود
                    </button>
                  </div>
                  <div className="grid-2">
                    {(siteForm.elevator_codes || ['']).map((code, index) => (
                      <div key={`elevator-code-${index}`} className="flex gap-8">
                        <input
                          type="text"
                          className="form-input"
                          value={code}
                          onChange={(e) => handleElevatorCodeChange(index, e.target.value)}
                          placeholder={`كود المصعد ${index + 1}`}
                        />
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm text-danger"
                          onClick={() => removeElevatorCodeField(index)}
                          disabled={(siteForm.elevator_codes || []).length <= 1}
                          title="حذف الكود"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">ملاحظات</label>
                  <textarea
                    className="form-textarea"
                    value={siteForm.notes}
                    onChange={(e) => handleSiteFormChange('notes', e.target.value)}
                    placeholder="ملاحظات إضافية..."
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="submit" className="btn btn-primary" disabled={savingSite}>
                  {editingSite ? <Edit size={18} /> : <Plus size={18} />}
                  {savingSite ? 'جاري الحفظ...' : editingSite ? 'حفظ التعديلات' : 'إضافة الموقع'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={closeSiteModal}>
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print PDF Vector Document Section for Client Statement */}
      {printActive && (
        <div className="print-only-container">
          <div className="print-header">
            <div className="print-logo-section">
              <img src="/logo-transparent.png" alt="عاصمة الكون" />
              <div>
                <h1>شركة عاصمة الكون للمصاعد</h1>
                <span style={{ fontSize: '0.85rem', color: '#555' }}>كشوف الحسابات والمديونيات التفصيلية</span>
              </div>
            </div>
            <div style={{ textAlign: 'left', direction: 'ltr' }}>
              <p>العميل: <strong>{client.name}</strong></p>
              <p>تاريخ الاستخراج: {new Date().toLocaleDateString('ar-SA')}</p>
            </div>
          </div>

          <div className="print-title">كشف حساب مالي رسمي وتفصيلي للعميل</div>

          <div className="print-meta-grid">
            <div className="print-meta-item">
              <span>المديونية الحالية (المستحقات المتبقية)</span>
              <strong style={{ color: '#ef4444' }}>{formatCurrency(totalDue)}</strong>
            </div>
            <div className="print-meta-item">
              <span>إجمالي المبالغ المسددة والمحصلة</span>
              <strong style={{ color: '#10b981' }}>{formatCurrency(totalPaid)}</strong>
            </div>
            <div className="print-meta-item">
              <span>عدد العقود الإجمالية</span>
              <strong>{contracts.length}</strong>
            </div>
            <div className="print-meta-item">
              <span>العقود النشطة الحالية</span>
              <strong>{activeContracts}</strong>
            </div>
          </div>

          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '15px', color: '#1e3a8a', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px' }}>
            سجل المعاملات والمدفوعات والمستحقات (Ledger Statement)
          </h3>

          <table className="print-table">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>بيان المعاملة</th>
                <th style={{ color: '#b91c1c' }}>مستحق / مدين (ر.س)</th>
                <th style={{ color: '#047857' }}>مسدد / دائن (ر.س)</th>
                <th>الرصيد التراكمي (ر.س)</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                let runningBalance = 0;
                return getLedger().map((item, idx) => {
                  if (item.type === 'debit') {
                    runningBalance += item.amount;
                  } else {
                    runningBalance -= item.amount;
                  }
                  return (
                    <tr key={idx}>
                      <td>{formatDate(item.date)}</td>
                      <td>{item.description}</td>
                      <td style={{ color: '#b91c1c', fontWeight: item.type === 'debit' ? 'bold' : 'normal' }}>
                        {item.type === 'debit' ? formatCurrency(item.amount) : '-'}
                      </td>
                      <td style={{ color: '#047857', fontWeight: item.type === 'credit' ? 'bold' : 'normal' }}>
                        {item.type === 'credit' ? formatCurrency(item.amount) : '-'}
                      </td>
                      <td><strong>{formatCurrency(runningBalance)}</strong></td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>

          <div style={{ float: 'left', marginTop: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '15px 30px', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b', display: 'block', marginBottom: '5px' }}>صافي المستحقات المتبقية للشركة:</span>
            <strong style={{ fontSize: '1.4rem', color: '#ef4444' }}>{formatCurrency(totalDue)}</strong>
          </div>

          <div className="print-footer" style={{ marginTop: '120px', clear: 'both' }}>
            <div className="print-signature">
              <span>المدير المالي والمحاسب</span>
              <strong>الاعتماد والختم الرسمي</strong>
            </div>
            <div className="print-signature">
              <span>الطرف الثاني (العميل)</span>
              <strong>موافقة الطرف الثاني</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClientProfile;
