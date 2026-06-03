import { Fragment, useEffect, useMemo, useState } from 'react';
import { supabase, formatCurrency, formatDate, CITIES, PAYMENT_METHODS, PAYMENT_FREQUENCIES, logActivity } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Download,
  Edit,
  FileText,
  Filter,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import { useAutocomplete } from '../contexts/AutocompleteContext';
import SmartInput from '../components/SmartInput';
import PrintHeader from '../components/PrintHeader';
import PrintFooter from '../components/PrintFooter';
import ContractPrintTemplate from '../components/ContractPrintTemplate';
import InstallPrintTemplate from '../components/InstallPrintTemplate';

const CONTRACT_TYPES = {
  supply_installation: 'توريد وتركيب مصاعد',
  maintenance: 'صيانة مصاعد'
};

const CONTRACT_STATUS_LABELS = {
  active: 'ساري',
  completed: 'منتهي',
  cancelled: 'موقوف'
};

const CLIENT_ADDRESS_SITE_ID = '__client_address__';

const EMPTY_FORM = {
  contract_type: 'supply_installation',
  contract_number: '',
  client_id: '',
  client_site_id: '',
  branch: 'mecca',
  title: '',
  service_type: CONTRACT_TYPES.supply_installation,
  total_amount: '',
  vat_amount: '',
  payment_method: 'bank_transfer',
  payment_frequency: 'one_time',
  start_date: '',
  end_date: '',
  status: 'active',
  details: {
    contract: {},
    customer: {},
    elevator: {},
    finishes: {},
    safety: {},
    maintenance: {},
    visits: {},
    sla: {},
    parts: {},
    links: {},
    alerts: {}
  },
  payment_schedule: [{ label: 'الدفعة الأولى', percentage: 100, amount: '', due_date: '' }],
  attachments: []
};

const INSTALL_SECTIONS = [
  {
    key: 'contract',
    title: 'بيانات العقد الأساسية',
    fields: [
      ['project_name', 'اسم المشروع'],
      ['project_location', 'موقع المشروع (المدينة والحي)'],
      ['contract_date', 'تاريخ العقد', 'date'],
      ['elevator_brand', 'ماركة المصعد']
    ]
  },
  {
    key: 'customer',
    title: 'بيانات العميل',
    fields: [
      ['customer_name', 'اسم العميل / المؤسسة'],
      ['identity_number', 'رقم الهوية / السجل التجاري'],
      ['address', 'العنوان'],
      ['mobile', 'رقم الجوال']
    ]
  },
  {
    key: 'elevator',
    title: 'المواصفات الفنية الرئيسية',
    fields: [
      ['elevator_type', 'نوع المصعد'],
      ['entrances', 'عدد المداخل', 'number'],
      ['speed', 'سرعة المصعد'],
      ['stops', 'عدد الوقفات', 'number'],
      ['travel_distance', 'مشوار الصاعدة'],
      ['machine_type', 'الماكينة'],
      ['shaft_type', 'نوع البئر'],
      ['machine_position', 'موضع الماكينة'],
      ['shaft_dimensions', 'أبعاد البئر'],
      ['capacity_persons', 'عدد الأشخاص / الحمولة'],
      ['door_dimensions', 'مقاس الباب'],
      ['outer_door_type', 'نوع الباب الخارجي'],
      ['inner_door_type', 'الباب الداخلي'],
      ['cam_type', 'الكامة']
    ]
  },
  {
    key: 'mechanical',
    title: 'المواصفات الميكانيكية والسكك',
    fields: [
      ['cabin_rails', 'سكك الكابينة'],
      ['counterweight_rails', 'سكك الثقل'],
      ['counterweight', 'ثقل الموازنة'],
      ['traction_ropes', 'حبال الجر'],
      ['electrical_wiring', 'التمديدات الكهربائية']
    ]
  },
  {
    key: 'cabin_control',
    title: 'الصاعدة ولوحة التحكم',
    fields: [
      ['floor_indicator', 'مبين الأدوار'],
      ['cabin_details', 'مواصفات الصاعدة (الكابينة)'],
      ['control_panel', 'لوحة التحكم (الكنترول)']
    ]
  },
  {
    key: 'safety',
    title: 'مواصفات الأمان',
    fields: [
      ['limit_switch', 'قاطع نهاية المشوار'],
      ['parachute', 'البراشوت'],
      ['revision_device', 'جهاز الريفيزيون'],
      ['oilers', 'المزايت'],
      ['flexible_cable', 'الكابل المرن'],
      ['shock_absorbers', 'مخفف الصدمات'],
      ['fire_brake_device', 'جهاز الفرامل في حالة الحريق']
    ]
  }
];

const MAINTENANCE_SECTIONS = [
  {
    key: 'contract',
    title: 'بيانات العقد',
    fields: [
      ['facility_name', 'اسم العميل / المنشأة'],
      ['facility_location', 'موقع المنشأة'],
      ['covered_elevators_count', 'عدد المصاعد المشمولة', 'number'],
      ['contract_duration', 'مدة العقد']
    ]
  },
  {
    key: 'customer',
    title: 'بيانات العميل',
    fields: [
      ['organization_name', 'اسم المؤسسة'],
      ['identity_number', 'السجل التجاري أو الهوية'],
      ['tax_number', 'الرقم الضريبي'],
      ['contact_data', 'بيانات التواصل'],
      ['responsible_person', 'الشخص المسؤول']
    ]
  },
  {
    key: 'elevator',
    title: 'المصاعد المشمولة بالصيانة',
    fields: [
      ['elevator_reference', 'مرجع المصعد'],
      ['brand', 'الماركة'],
      ['capacity', 'الحمولة'],
      ['stops', 'عدد الوقفات', 'number'],
      ['serial_number', 'الرقم التسلسلي']
    ]
  },
  {
    key: 'maintenance',
    title: 'نوع الصيانة',
    fields: [
      ['preventive', 'صيانة وقائية'],
      ['corrective', 'صيانة تصحيحية'],
      ['emergency_247', 'طوارئ 24/7']
    ]
  },
  {
    key: 'visits',
    title: 'خطة الزيارات',
    fields: [
      ['monthly_visits', 'عدد الزيارات الشهرية', 'number'],
      ['quarterly_visits', 'الزيارات الربع سنوية'],
      ['annual_visit', 'الزيارة السنوية الشاملة']
    ]
  },
  {
    key: 'sla',
    title: 'مستوى الخدمة (SLA)',
    fields: [
      ['failure_response_time', 'زمن الاستجابة للأعطال'],
      ['emergency_response_time', 'زمن الاستجابة للطوارئ'],
      ['working_hours', 'أوقات العمل'],
      ['emergency_numbers', 'أرقام الطوارئ']
    ]
  },
  {
    key: 'parts',
    title: 'القطع والمواد',
    fields: [
      ['included_parts', 'القطع المشمولة بالعقد'],
      ['excluded_parts', 'القطع غير المشمولة'],
      ['client_responsibility', 'مسؤولية العميل'],
      ['company_responsibility', 'مسؤولية الشركة']
    ]
  }
];

function cloneForm() {
  return JSON.parse(JSON.stringify(EMPTY_FORM));
}

function parseNotes(notes) {
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

function Contracts({ cityFilter = 'all' }) {
  const { profile } = useAuth();
  const { saveMemory } = useAutocomplete();

  const [contracts, setContracts] = useState([]);
  const [clients, setClients] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedContract, setExpandedContract] = useState(null);
  const [scheduleData, setScheduleData] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const [renewingContract, setRenewingContract] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingContract, setCancellingContract] = useState(null);
  const [saving, setSaving] = useState(false);
  const [plainNotes, setPlainNotes] = useState('');
  const [printContractItem, setPrintContractItem] = useState(null);

  const [form, setForm] = useState(cloneForm);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCity, setFilterCity] = useState(cityFilter === 'all' ? '' : cityFilter);
  const [filterType, setFilterType] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setFilterCity(cityFilter === 'all' ? '' : cityFilter);
  }, [cityFilter]);

  async function fetchData() {
    try {
      setLoading(true);
      const [contractsRes, clientsRes, sitesRes] = await Promise.all([
        supabase.from('contracts').select('*, clients(name, phone)').order('created_at', { ascending: false }),
        supabase.from('clients').select('id, name, phone, email, address, city, contact_person').neq('status', 'inactive').order('name'),
        supabase.from('client_sites').select('*').order('created_at', { ascending: false })
      ]);

      if (contractsRes.error) throw contractsRes.error;
      if (clientsRes.error) throw clientsRes.error;
      if (sitesRes.error) throw sitesRes.error;

      setContracts(contractsRes.data || []);
      setClients(clientsRes.data || []);
      setSites(sitesRes.data || []);
    } catch (err) {
      console.error('خطأ في جلب بيانات العقود:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSchedule(contractId) {
    try {
      setLoadingSchedule(true);
      const { data, error } = await supabase
        .from('collection_schedule')
        .select('*')
        .eq('contract_id', contractId)
        .order('due_date', { ascending: true });

      if (error) throw error;
      setScheduleData(data || []);
    } catch (err) {
      console.error('خطأ في جلب جدول الدفعات:', err);
    } finally {
      setLoadingSchedule(false);
    }
  }

  const enrichedContracts = useMemo(() => contracts.map(contract => {
    const parsed = parseNotes(contract.notes);
    return {
      ...contract,
      meta: parsed,
      contract_type: parsed.details?.contract_type || (contract.service_type?.includes('صيانة') ? 'maintenance' : 'supply_installation')
    };
  }), [contracts]);

  const activeContracts = enrichedContracts.filter(c => c.status === 'active').length;
  const expiringSoon = enrichedContracts.filter(c => {
    if (!c.end_date || c.status !== 'active') return false;
    const days = Math.ceil((new Date(c.end_date) - new Date()) / 86400000);
    return days >= 0 && days <= 30;
  }).length;
  const totalValue = enrichedContracts
    .filter(c => c.status === 'active')
    .reduce((sum, c) => sum + (parseFloat(c.total_amount) || 0), 0);

  const filteredContracts = enrichedContracts.filter(c => {
    if (filterStatus && c.status !== filterStatus) return false;
    if (filterCity && c.branch !== filterCity) return false;
    if (filterType && c.contract_type !== filterType) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const haystack = [
        c.clients?.name,
        c.contract_number,
        c.title,
        c.service_type,
        c.meta?.details?.contract?.project_name,
        c.meta?.details?.contract?.facility_name
      ].join(' ').toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });

  const selectedClient = clients.find(client => client.id === form.client_id);
  const savedClientSites = sites.filter(site => site.client_id === form.client_id);
  const clientAddressSite = selectedClient?.address
    ? {
      id: CLIENT_ADDRESS_SITE_ID,
      site_name: 'موقع العميل المسجل',
      address: selectedClient.address,
      city: selectedClient.city,
      elevator_count: '',
      elevator_type: ''
    }
    : null;
  const clientSites = clientAddressSite ? [...savedClientSites, clientAddressSite] : savedClientSites;

  function getStatusBadge(status) {
    const map = {
      active: 'badge-success',
      completed: 'badge-info',
      cancelled: 'badge-danger'
    };
    return map[status] || 'badge-secondary';
  }

  function getScheduleStatusBadge(status) {
    const map = {
      pending: 'badge-warning',
      collected: 'badge-success',
      overdue: 'badge-danger',
      partial: 'badge-info'
    };
    return map[status] || 'badge-secondary';
  }

  function generateContractNumber() {
    return `CT-${Date.now().toString().slice(-8)}`;
  }

  function resetForm(nextType = 'supply_installation') {
    const next = cloneForm();
    next.contract_type = nextType;
    next.service_type = CONTRACT_TYPES[nextType];
    next.contract_number = generateContractNumber();
    setForm(next);
    setPlainNotes('');
  }

  function openAddModal(type = 'supply_installation') {
    setEditingContract(null);
    setRenewingContract(null);
    resetForm(type);
    setShowFormModal(true);
  }

  async function openEditModal(contract, mode = 'edit') {
    const parsed = parseNotes(contract.notes);
    const schedule = await supabase
      .from('collection_schedule')
      .select('*')
      .eq('contract_id', contract.id)
      .order('due_date', { ascending: true });

    const details = parsed.details || {};
    const type = details.contract_type || contract.contract_type || 'supply_installation';
    const next = cloneForm();
    next.contract_type = type;
    next.contract_number = mode === 'renew' ? generateContractNumber() : contract.contract_number || '';
    next.client_id = contract.client_id || '';
    next.client_site_id = details.links?.client_site_id || '';
    next.branch = contract.branch || 'mecca';
    next.title = mode === 'renew' ? `${contract.title || ''} - تجديد` : contract.title || '';
    next.service_type = contract.service_type || CONTRACT_TYPES[type];
    next.total_amount = contract.total_amount || '';
    next.vat_amount = details.financial?.vat_amount || '';
    next.payment_method = contract.payment_method || 'bank_transfer';
    next.payment_frequency = contract.payment_frequency || 'one_time';
    next.start_date = mode === 'renew' ? new Date().toISOString().slice(0, 10) : contract.start_date || '';
    next.end_date = contract.end_date || '';
    next.status = mode === 'renew' ? 'active' : contract.status || 'active';
    next.details = { ...next.details, ...details };
    next.attachments = parsed.attachments || [];
    next.payment_schedule = (schedule.data || []).length
      ? schedule.data.map((item, index) => ({
        id: item.id,
        label: item.notes || `دفعة ${index + 1}`,
        percentage: '',
        amount: item.amount || '',
        due_date: item.due_date || ''
      }))
      : next.payment_schedule;

    setForm(next);
    setPlainNotes(parsed.plainNotes || '');
    setEditingContract(mode === 'edit' ? contract : null);
    setRenewingContract(mode === 'renew' ? contract : null);
    setShowFormModal(true);
  }

  function closeFormModal() {
    setShowFormModal(false);
    setEditingContract(null);
    setRenewingContract(null);
    resetForm();
  }

  function updateForm(field, value) {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'contract_type') {
        next.service_type = CONTRACT_TYPES[value];
        next.title = CONTRACT_TYPES[value];
      }
      if (field === 'client_id') {
        const client = clients.find(c => c.id === value);
        const firstSavedSite = sites.find(site => site.client_id === value);
        const defaultSite = firstSavedSite || (client?.address
          ? {
            id: CLIENT_ADDRESS_SITE_ID,
            site_name: 'موقع العميل المسجل',
            address: client.address,
            city: client.city,
            elevator_count: '',
            elevator_type: ''
          }
          : null);

        next.client_site_id = defaultSite?.id || '';
        next.branch = client?.city || next.branch;
        next.details = {
          ...next.details,
          links: {
            ...next.details.links,
            client_site_id: defaultSite?.id === CLIENT_ADDRESS_SITE_ID ? null : defaultSite?.id || '',
            uses_client_address: defaultSite?.id === CLIENT_ADDRESS_SITE_ID
          },
          contract: {
            ...next.details.contract,
            project_name: defaultSite?.site_name || client?.name || '',
            project_location: defaultSite?.address || client?.address || '',
            facility_name: client?.name || '',
            facility_location: defaultSite?.address || client?.address || '',
            covered_elevators_count: defaultSite?.elevator_count || next.details.contract.covered_elevators_count || ''
          },
          customer: {
            ...next.details.customer,
            customer_name: client?.name || '',
            organization_name: client?.name || '',
            mobile: client?.phone || '',
            email: client?.email || '',
            address: client?.address || '',
            contact_data: client?.phone || '',
            responsible_person: client?.contact_person || ''
          }
        };
      }
      if (field === 'client_site_id') {
        const client = clients.find(c => c.id === next.client_id);
        const site = value === CLIENT_ADDRESS_SITE_ID
          ? {
            id: CLIENT_ADDRESS_SITE_ID,
            site_name: 'موقع العميل المسجل',
            address: client?.address || '',
            city: client?.city,
            elevator_count: '',
            elevator_type: ''
          }
          : sites.find(s => s.id === value);

        next.branch = site?.city || next.branch;
        next.details = {
          ...next.details,
          links: {
            ...next.details.links,
            client_site_id: value === CLIENT_ADDRESS_SITE_ID ? null : value,
            uses_client_address: value === CLIENT_ADDRESS_SITE_ID
          },
          contract: {
            ...next.details.contract,
            project_name: site?.site_name || next.details.contract.project_name || '',
            project_location: site?.address || next.details.contract.project_location || '',
            facility_location: site?.address || next.details.contract.facility_location || '',
            covered_elevators_count: site?.elevator_count || next.details.contract.covered_elevators_count || ''
          },
          elevator: {
            ...next.details.elevator,
            elevator_type: site?.elevator_type || next.details.elevator.elevator_type || ''
          }
        };
      }
      return next;
    });
  }

  function updateDetail(section, field, value) {
    setForm(prev => ({
      ...prev,
      details: {
        ...prev.details,
        [section]: {
          ...prev.details[section],
          [field]: value
        }
      }
    }));
  }

  function addPaymentRow() {
    setForm(prev => ({
      ...prev,
      payment_schedule: [...prev.payment_schedule, { label: `دفعة ${prev.payment_schedule.length + 1}`, percentage: '', amount: '', due_date: '' }]
    }));
  }

  function updatePaymentRow(index, field, value) {
    setForm(prev => {
      const rows = [...prev.payment_schedule];
      rows[index] = { ...rows[index], [field]: value };
      if (field === 'percentage' && form.total_amount) {
        rows[index].amount = ((parseFloat(form.total_amount) || 0) * (parseFloat(value) || 0) / 100).toFixed(2);
      }
      return { ...prev, payment_schedule: rows };
    });
  }

  function removePaymentRow(index) {
    setForm(prev => ({
      ...prev,
      payment_schedule: prev.payment_schedule.length === 1
        ? prev.payment_schedule
        : prev.payment_schedule.filter((_, rowIndex) => rowIndex !== index)
    }));
  }

  function handleAttachmentChange(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setForm(prev => ({
      ...prev,
      attachments: [
        ...prev.attachments,
        ...files.map(file => ({
          name: file.name,
          size: file.size,
          type: file.type,
          added_at: new Date().toISOString(),
          _file: file
        }))
      ]
    }));
    event.target.value = '';
  }

  function removeAttachment(index) {
    setForm(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, fileIndex) => fileIndex !== index)
    }));
  }

  async function handleSaveContract(event) {
    event.preventDefault();
    if (!form.client_id || !form.contract_number || !form.total_amount || !form.start_date) {
      alert('يرجى تعبئة رقم العقد والعميل وقيمة العقد وتاريخ البداية');
      return;
    }

    try {
      setSaving(true);
      const uploadedAttachments = await uploadContractAttachments(form.attachments, form.contract_number);
      const details = {
        ...form.details,
        contract_type: form.contract_type,
        financial: {
          vat_amount: form.vat_amount,
          payment_schedule: form.payment_schedule
        },
        links: {
          ...form.details.links,
          client_site_id: form.client_site_id === CLIENT_ADDRESS_SITE_ID ? null : form.client_site_id,
          uses_client_address: form.client_site_id === CLIENT_ADDRESS_SITE_ID
        }
      };

      const payload = {
        contract_number: form.contract_number,
        client_id: form.client_id,
        service_type: form.service_type || CONTRACT_TYPES[form.contract_type],
        title: form.title || CONTRACT_TYPES[form.contract_type],
        total_amount: parseFloat(form.total_amount) || 0,
        payment_frequency: form.payment_frequency,
        payment_method: form.payment_method,
        installment_amount: null,
        start_date: form.start_date,
        end_date: form.end_date || null,
        status: form.status,
        branch: form.branch,
        notes: JSON.stringify({
          plainNotes,
          details,
          attachments: uploadedAttachments
        }),
        created_by: profile?.id
      };

      const query = editingContract
        ? supabase.from('contracts').update(payload).eq('id', editingContract.id).select().single()
        : supabase.from('contracts').insert(payload).select().single();

      const { data: contractData, error } = await query;
      if (error) throw error;

      if (editingContract) {
        await supabase.from('collection_schedule').delete().eq('contract_id', editingContract.id);
      }

      let insertedCollections = [];
      const validPayments = form.payment_schedule.filter(row => row.amount && row.due_date);
      if (validPayments.length > 0) {
        const scheduleRows = validPayments.map(row => ({
          contract_id: contractData.id,
          client_id: form.client_id,
          due_date: row.due_date,
          amount: parseFloat(row.amount) || 0,
          status: 'pending',
          notes: row.label || null,
          branch: form.branch
        }));
        const { data: cols, error: scheduleError } = await supabase.from('collection_schedule').insert(scheduleRows).select();
        if (scheduleError) throw scheduleError;
        insertedCollections = cols || [];
      }

      if (form.contract_type === 'maintenance') {
        if (editingContract) {
          // Delete future pending visits to regenerate them
          await supabase.from('maintenance_visits').delete()
            .eq('contract_id', editingContract.id)
            .eq('status', 'pending');
        }

        const startDate = new Date(form.start_date);
        const endDate = new Date(form.end_date || new Date(startDate).setFullYear(startDate.getFullYear() + 1));
        let currentDate = new Date(startDate);
        // Start from next month if we want the first visit after a month, or start immediately. Usually visits are monthly.
        
        const visits = [];
        while (currentDate <= endDate) {
          const currentMonthStr = currentDate.toISOString().slice(0, 7);
          const matchedCollection = insertedCollections.find(c => c.due_date.startsWith(currentMonthStr));
          
          visits.push({
            contract_id: contractData.id,
            client_id: form.client_id,
            scheduled_date: currentDate.toISOString().split('T')[0],
            status: 'pending',
            has_collection: !!matchedCollection,
            collection_id: matchedCollection ? matchedCollection.id : null,
            branch: form.branch
          });
          currentDate.setMonth(currentDate.getMonth() + 1);
        }

        if (visits.length > 0) {
          await supabase.from('maintenance_visits').insert(visits);
        }
      } else if (form.contract_type === 'supply_installation') {
        if (editingContract) {
          await supabase.from('installation_phases').delete()
            .eq('contract_id', editingContract.id)
            .eq('status', 'pending');
        }

        const startDate = new Date(form.start_date);
        
        // As per standard contract:
        // Phase 1: Sign contract & Rails/Doors supply (At start)
        // Phase 2: Rails/Doors installation finish (Requires Phase 1 finish)
        // Phase 3: Control supply & operation (Requires Phase 2 finish & Phase 2 payment)
        
        const phases = [
          { phase_number: 1, phase_name: 'عند التعاقد لتوريد وتركيب السكة والأبواب' },
          { phase_number: 2, phase_name: 'بعد الانتهاء من تركيب السكك والابواب' },
          { phase_number: 3, phase_name: 'توريد وتركيب الكنترول وتشغيل المصعد' }
        ];

        const dbPhases = phases.map((phase, index) => {
          // Link to collection_schedule if it exists (e.g. Phase 1 -> Payment 1, Phase 2 -> Payment 2)
          const matchedCollection = insertedCollections[index] || null;
          
          let scheduleDate = new Date(startDate);
          scheduleDate.setDate(scheduleDate.getDate() + (index * 30)); // Approximate +30 days for each phase

          return {
            contract_id: contractData.id,
            client_id: form.client_id,
            phase_number: phase.phase_number,
            phase_name: phase.phase_name,
            scheduled_date: scheduleDate.toISOString().split('T')[0],
            status: 'pending',
            collection_id: matchedCollection ? matchedCollection.id : null,
            branch: form.branch
          };
        });

        if (dbPhases.length > 0) {
          await supabase.from('installation_phases').insert(dbPhases);
        }
      }

      await logActivity(
        profile?.id,
        profile?.full_name,
        editingContract ? 'تعديل عقد' : renewingContract ? 'تجديد عقد' : 'إنشاء عقد',
        'contracts',
        contractData.id,
        `${editingContract ? 'تم تعديل' : renewingContract ? 'تم تجديد' : 'تم إنشاء'} العقد ${form.contract_number}`,
        form.branch
      );

      // Save memory for autocomplete
      const memoryItems = [];
      const currentSections = form.contract_type === 'maintenance' ? MAINTENANCE_SECTIONS : INSTALL_SECTIONS;
      currentSections.forEach(section => {
        section.fields.forEach(([field, label, type = 'text']) => {
          if (type === 'text' && form.details?.[section.key]?.[field]) {
            memoryItems.push({ category: field, value: form.details[section.key][field] });
          }
        });
      });
      saveMemory(memoryItems);

      closeFormModal();
      fetchData();
    } catch (err) {
      console.error('خطأ في حفظ العقد:', err);
      alert(`حدث خطأ أثناء حفظ العقد: ${err.message || 'خطأ غير معروف'}`);
    } finally {
      setSaving(false);
    }
  }

  async function uploadContractAttachments(attachments, contractNumber) {
    const uploaded = [];

    for (const attachment of attachments) {
      if (!attachment._file) {
        uploaded.push(attachment);
        continue;
      }

      const rawExtension = attachment.name?.split('.').pop() || 'bin';
      const extension = rawExtension.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'bin';
      const safeContractNumber = String(contractNumber || 'contract').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filePath = `contracts/${safeContractNumber}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, attachment._file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      uploaded.push({
        name: attachment.name,
        size: attachment.size,
        type: attachment.type,
        path: filePath,
        url: urlData?.publicUrl || null,
        added_at: attachment.added_at || new Date().toISOString()
      });
    }

    return uploaded;
  }

  function toggleExpand(contractId) {
    if (expandedContract === contractId) {
      setExpandedContract(null);
      setScheduleData([]);
    } else {
      setExpandedContract(contractId);
      fetchSchedule(contractId);
    }
  }

  function openCancelModal(contract) {
    setCancellingContract(contract);
    setShowCancelModal(true);
  }

  async function handleCancelContract() {
    if (!cancellingContract) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('contracts')
        .update({ status: 'cancelled' })
        .eq('id', cancellingContract.id);

      if (error) throw error;

      setShowCancelModal(false);
      setCancellingContract(null);
      fetchData();
    } catch (err) {
      console.error('خطأ في إيقاف العقد:', err);
    } finally {
      setSaving(false);
    }
  }

  async function printContract(contract) {
    try {
      // Fetch the schedule rows first
      const { data: scheduleRows } = await supabase
        .from('collection_schedule')
        .select('*')
        .eq('contract_id', contract.id)
        .order('due_date', { ascending: true });

      // Put them inside the contract object
      const contractWithSchedule = {
        ...contract,
        payment_schedule: scheduleRows || []
      };

      setPrintContractItem(contractWithSchedule);
      setTimeout(() => {
        window.print();
        setPrintContractItem(null);
      }, 150);
    } catch (e) {
      console.error(e);
      // Fallback: print without schedule
      setPrintContractItem(contract);
      setTimeout(() => {
        window.print();
        setPrintContractItem(null);
      }, 150);
    }
  }

  const currentSections = form.contract_type === 'maintenance' ? MAINTENANCE_SECTIONS : INSTALL_SECTIONS;

  if (loading) {
    return (
      <div className="loading-inline">
        <div className="loader"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          <span className="title-icon" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
            <FileText size={24} />
          </span>
          العقود
        </h1>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => openAddModal('supply_installation')}>
            <Plus size={18} />
            عقد توريد وتركيب
          </button>
          <button className="btn btn-secondary" onClick={() => openAddModal('maintenance')}>
            <Plus size={18} />
            عقد صيانة
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card success">
          <div className="stat-info">
            <div className="stat-label">عقود سارية</div>
            <div className="stat-value">{activeContracts}</div>
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-info">
            <div className="stat-label">تنبيهات خلال 30 يوم</div>
            <div className="stat-value">{expiringSoon}</div>
          </div>
        </div>

        <div className="stat-card primary">
          <div className="stat-info">
            <div className="stat-label">إجمالي قيمة العقود السارية</div>
            <div className="stat-value">{formatCurrency(totalValue)}</div>
          </div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-group">
          <Filter size={18} />
          <select className="form-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">كل الحالات</option>
            {Object.entries(CONTRACT_STATUS_LABELS).map(([key, val]) => (
              <option key={key} value={key}>{val}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <select className="form-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">كل أنواع العقود</option>
            {Object.entries(CONTRACT_TYPES).map(([key, val]) => (
              <option key={key} value={key}>{val}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <select className="form-select" value={filterCity} onChange={e => setFilterCity(e.target.value)}>
            <option value="">كل الفروع</option>
            {Object.entries(CITIES).map(([key, val]) => (
              <option key={key} value={key}>{val}</option>
            ))}
          </select>
        </div>

        <div className="filter-group search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="form-input search-input"
            placeholder="بحث بالعميل أو رقم العقد أو المشروع..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="table-container">
        {filteredContracts.length === 0 ? (
          <div className="empty-state">
            <FileText size={64} />
            <h3>لا توجد عقود</h3>
            <p>ابدأ بإنشاء عقد توريد وتركيب أو عقد صيانة جديد.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>رقم العقد</th>
                <th>نوع العقد</th>
                <th>العميل</th>
                <th>المشروع / المنشأة</th>
                <th>القيمة</th>
                <th>تاريخ البداية</th>
                <th>تاريخ الانتهاء</th>
                <th>الحالة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredContracts.map(contract => (
                <Fragment key={contract.id}>
                  <tr>
                    <td><strong>{contract.contract_number || '-'}</strong></td>
                    <td>{CONTRACT_TYPES[contract.contract_type] || contract.service_type || '-'}</td>
                    <td>{contract.clients?.name || '-'}</td>
                    <td>{contract.meta?.details?.contract?.project_name || contract.meta?.details?.contract?.facility_name || contract.title || '-'}</td>
                    <td><strong>{formatCurrency(contract.total_amount)}</strong></td>
                    <td>{formatDate(contract.start_date)}</td>
                    <td>{formatDate(contract.end_date)}</td>
                    <td>
                      <span className={`badge ${getStatusBadge(contract.status)}`}>
                        {CONTRACT_STATUS_LABELS[contract.status] || contract.status}
                      </span>
                    </td>
                    <td>
                      <div className="page-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleExpand(contract.id)} title="تفاصيل وجدول الدفعات">
                          {expandedContract === contract.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(contract)} title="تعديل العقد">
                          <Edit size={16} />
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(contract, 'renew')} title="تجديد العقد">
                          <RefreshCw size={16} />
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => printContract(contract)} title="طباعة PDF">
                          <Printer size={16} />
                        </button>
                        {contract.status === 'active' && (
                          <button className="btn btn-ghost btn-sm text-danger" onClick={() => openCancelModal(contract)} title="إيقاف العقد">
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {expandedContract === contract.id && (
                    <tr>
                      <td colSpan={9}>
                        <div className="card">
                          <div className="card-header">
                            <h3 className="card-title">
                              <Calendar size={18} />
                              جدول الدفعات والمرفقات والتنبيهات
                            </h3>
                          </div>
                          <div className="card-body">
                            <div className="form-row-3 mb-24">
                              <div>
                                <span className="form-label">طريقة السداد</span>
                                <p className="font-bold">{PAYMENT_METHODS[contract.payment_method] || contract.payment_method || '-'}</p>
                              </div>
                              <div>
                                <span className="form-label">دورية الدفعات</span>
                                <p className="font-bold">{PAYMENT_FREQUENCIES[contract.payment_frequency] || contract.payment_frequency || '-'}</p>
                              </div>
                              <div>
                                <span className="form-label">ضريبة القيمة المضافة</span>
                                <p className="font-bold">{formatCurrency(contract.meta?.details?.financial?.vat_amount || 0)}</p>
                              </div>
                            </div>

                            {loadingSchedule ? (
                              <div className="empty-state"><p>جاري التحميل...</p></div>
                            ) : scheduleData.length === 0 ? (
                              <div className="empty-state"><p>لا يوجد جدول دفعات لهذا العقد</p></div>
                            ) : (
                              <table className="data-table">
                                <thead>
                                  <tr>
                                    <th>الدفعة</th>
                                    <th>تاريخ الاستحقاق</th>
                                    <th>المبلغ المستحق</th>
                                    <th>المبلغ المحصل</th>
                                    <th>المتبقي</th>
                                    <th>الحالة</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {scheduleData.map(item => {
                                    const remaining = (parseFloat(item.amount) || 0) - (parseFloat(item.collected_amount) || 0);
                                    return (
                                      <tr key={item.id}>
                                        <td>{item.notes || '-'}</td>
                                        <td>{formatDate(item.due_date)}</td>
                                        <td>{formatCurrency(item.amount)}</td>
                                        <td>{formatCurrency(item.collected_amount || 0)}</td>
                                        <td><strong>{formatCurrency(remaining > 0 ? remaining : 0)}</strong></td>
                                        <td>
                                          <span className={`badge ${getScheduleStatusBadge(item.status)}`}>
                                            {item.status === 'pending' && 'معلق'}
                                            {item.status === 'collected' && 'محصل'}
                                            {item.status === 'overdue' && 'متأخر'}
                                            {item.status === 'partial' && 'جزئي'}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}

                            <div className="mt-24">
                              <h4 className="font-semibold mb-16">المرفقات</h4>
                              {(contract.meta?.attachments || []).length === 0 ? (
                                <p className="text-muted">لا توجد مرفقات مسجلة.</p>
                              ) : (
                                <div className="flex gap-12" style={{ flexWrap: 'wrap' }}>
                                  {contract.meta.attachments.map((file, index) => (
                                    <a
                                      key={`${file.name}-${index}`}
                                      className="badge badge-secondary"
                                      href={file.url || '#'}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={event => !file.url && event.preventDefault()}
                                    >
                                      <Download size={12} />
                                      {file.name}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showFormModal && (
        <div className="modal-overlay" onClick={closeFormModal}>
          <div className="modal-content modal-xl" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingContract ? 'تعديل العقد' : renewingContract ? 'تجديد العقد' : 'إضافة عقد جديد'}
              </h2>
              <button className="modal-close" onClick={closeFormModal}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveContract}>
              <div className="modal-body">
                <div className="card mb-24">
                  <div className="card-header">
                    <h3 className="card-title"><FileText size={18} /> نوع العقد والربط</h3>
                  </div>
                  <div className="card-body">
                    <div className="form-row-3">
                      <div className="form-group">
                        <label className="form-label">نوع العقد *</label>
                        <select className="form-select" value={form.contract_type} onChange={e => updateForm('contract_type', e.target.value)}>
                          {Object.entries(CONTRACT_TYPES).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">رقم العقد *</label>
                        <input className="form-input" value={form.contract_number} onChange={e => updateForm('contract_number', e.target.value)} required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">الحالة</label>
                        <select className="form-select" value={form.status} onChange={e => updateForm('status', e.target.value)}>
                          {Object.entries(CONTRACT_STATUS_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="form-row-3">
                      <div className="form-group">
                        <label className="form-label">العميل *</label>
                        <select className="form-select" value={form.client_id} onChange={e => updateForm('client_id', e.target.value)} required>
                          <option value="">اختر العميل</option>
                          {clients.map(client => (
                            <option key={client.id} value={client.id}>{client.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">المشروع / موقع العميل</label>
                        <select className="form-select" value={form.client_site_id} onChange={e => updateForm('client_site_id', e.target.value)}>
                          <option value="">بدون ربط موقع</option>
                          {clientSites.map(site => (
                            <option key={site.id} value={site.id}>{site.site_name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">الفرع</label>
                        <select className="form-select" value={form.branch} onChange={e => updateForm('branch', e.target.value)}>
                          {Object.entries(CITIES).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {currentSections.map(section => (
                  <div className="card mb-24" key={section.key}>
                    <div className="card-header">
                      <h3 className="card-title">{section.title}</h3>
                    </div>
                    <div className="card-body">
                      <div className="form-row-3">
                        {section.fields.map(([field, label, type = 'text']) => (
                          <div className="form-group" key={`${section.key}-${field}`}>
                            <label className="form-label">{label}</label>
                            {type === 'text' ? (
                              <SmartInput
                                category={field}
                                type={type}
                                className="form-input"
                                value={form.details?.[section.key]?.[field] || ''}
                                onChange={e => updateDetail(section.key, field, e.target.value)}
                              />
                            ) : (
                              <input
                                type={type}
                                className="form-input"
                                value={form.details?.[section.key]?.[field] || ''}
                                onChange={e => updateDetail(section.key, field, e.target.value)}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                <div className="card mb-24">
                  <div className="card-header">
                    <h3 className="card-title">البيانات المالية وجدول الدفعات</h3>
                    <button type="button" className="btn btn-primary btn-sm" onClick={addPaymentRow}>
                      <Plus size={16} />
                      إضافة دفعة
                    </button>
                  </div>
                  <div className="card-body">
                    <div className="form-row-3">
                      <div className="form-group">
                        <label className="form-label">قيمة العقد *</label>
                        <input type="number" className="form-input" value={form.total_amount} onChange={e => updateForm('total_amount', e.target.value)} min="0" step="0.01" required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">ضريبة القيمة المضافة</label>
                        <input type="number" className="form-input" value={form.vat_amount} onChange={e => updateForm('vat_amount', e.target.value)} min="0" step="0.01" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">طريقة السداد</label>
                        <select className="form-select" value={form.payment_method} onChange={e => updateForm('payment_method', e.target.value)}>
                          {Object.entries(PAYMENT_METHODS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="form-row-3">
                      <div className="form-group">
                        <label className="form-label">دورية السداد</label>
                        <select className="form-select" value={form.payment_frequency} onChange={e => updateForm('payment_frequency', e.target.value)}>
                          {Object.entries(PAYMENT_FREQUENCIES).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">تاريخ بداية العقد *</label>
                        <input type="date" className="form-input" value={form.start_date} onChange={e => updateForm('start_date', e.target.value)} required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">تاريخ الانتهاء / التجديد</label>
                        <input type="date" className="form-input" value={form.end_date} onChange={e => updateForm('end_date', e.target.value)} />
                      </div>
                    </div>

                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>اسم الدفعة</th>
                          <th>النسبة</th>
                          <th>المبلغ</th>
                          <th>تاريخ الاستحقاق</th>
                          <th>حذف</th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.payment_schedule.map((row, index) => (
                          <tr key={index}>
                            <td><input className="form-input" value={row.label} onChange={e => updatePaymentRow(index, 'label', e.target.value)} /></td>
                            <td><input type="number" className="form-input" value={row.percentage} onChange={e => updatePaymentRow(index, 'percentage', e.target.value)} min="0" max="100" /></td>
                            <td><input type="number" className="form-input" value={row.amount} onChange={e => updatePaymentRow(index, 'amount', e.target.value)} min="0" step="0.01" /></td>
                            <td><input type="date" className="form-input" value={row.due_date} onChange={e => updatePaymentRow(index, 'due_date', e.target.value)} /></td>
                            <td>
                              <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => removePaymentRow(index)} disabled={form.payment_schedule.length === 1}>
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card mb-24">
                  <div className="card-header">
                    <h3 className="card-title"><Upload size={18} /> المرفقات والتنبيهات</h3>
                  </div>
                  <div className="card-body">
                    <div className="form-row-3">
                      <div className="form-group">
                        <label className="form-label">تنبيه قبل انتهاء العقد (أيام)</label>
                        <input type="number" className="form-input" value={form.details.alerts?.expiry_days || ''} onChange={e => updateDetail('alerts', 'expiry_days', e.target.value)} min="0" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">تنبيه قبل الدفعة (أيام)</label>
                        <input type="number" className="form-input" value={form.details.alerts?.payment_days || ''} onChange={e => updateDetail('alerts', 'payment_days', e.target.value)} min="0" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">تنبيه قبل التجديد (أيام)</label>
                        <input type="number" className="form-input" value={form.details.alerts?.renewal_days || ''} onChange={e => updateDetail('alerts', 'renewal_days', e.target.value)} min="0" />
                      </div>
                    </div>

                    <div className="file-upload" onClick={() => document.getElementById('contract-files-input')?.click()}>
                      <Upload size={36} />
                      <p>ارفع المخططات، المواصفات الفنية، صور المشروع، نسخة العقد، تقارير الصيانة أو PDF/Word</p>
                      <input
                        id="contract-files-input"
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                        onChange={handleAttachmentChange}
                        hidden
                      />
                    </div>

                    {form.attachments.length > 0 && (
                      <div className="mt-16 flex gap-12" style={{ flexWrap: 'wrap' }}>
                        {form.attachments.map((file, index) => (
                          <span key={`${file.name}-${index}`} className="badge badge-secondary">
                            {file.name}
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeAttachment(index)}>
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="form-group mt-24">
                      <label className="form-label">ملاحظات إضافية</label>
                      <textarea className="form-textarea" rows={3} value={plainNotes} onChange={e => setPlainNotes(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <Save size={18} />
                  {saving ? 'جاري الحفظ...' : 'حفظ العقد'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={closeFormModal}>
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCancelModal && cancellingContract && (
        <div className="modal-overlay" onClick={() => setShowCancelModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">إيقاف العقد</h2>
              <button className="modal-close" onClick={() => setShowCancelModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="empty-state">
                <h3>هل تريد إيقاف هذا العقد؟</h3>
                <p>
                  العقد رقم: <strong>{cancellingContract.contract_number}</strong>
                  <br />
                  العميل: <strong>{cancellingContract.clients?.name}</strong>
                  <br />
                  القيمة: <strong>{formatCurrency(cancellingContract.total_amount)}</strong>
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-danger" onClick={handleCancelContract} disabled={saving}>
                {saving ? 'جاري الإيقاف...' : 'تأكيد الإيقاف'}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowCancelModal(false)}>
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print PDF Vector Document Section */}
      <div style={{ display: 'none' }}>
        <div ref={printRef}>
          {printData && printData.contract_type === 'supply_installation' ? (
            <InstallPrintTemplate contract={printData} />
          ) : (
            printData && <ContractPrintTemplate contract={printData} />
          )}
        </div>
      </div>
    </div>
  );
}

export default Contracts;
