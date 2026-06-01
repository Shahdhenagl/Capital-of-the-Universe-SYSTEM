import { useState, useEffect } from 'react';
import { supabase, formatCurrency, formatDate, CITIES, CONTRACT_STATUS, PAYMENT_METHODS, PAYMENT_FREQUENCIES, logActivity } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Plus, Search, Calendar, DollarSign, Filter, ChevronDown, ChevronUp, X, Check, Eye, Printer, Trash2, ShieldAlert } from 'lucide-react';
import { notifyIntegrations } from '../lib/integrations';

function Contracts() {
  const { profile } = useAuth();

  const [contracts, setContracts] = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [pendingQuotations, setPendingQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('contracts'); // 'contracts' or 'pending'
  
  // Expanded schedule state
  const [expandedContract, setExpandedContract] = useState(null);
  const [scheduleData, setScheduleData] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  
  // Modals state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingContract, setCancellingContract] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // PDF Printing state
  const [printItem, setPrintItem] = useState(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // New Contract Form
  const [form, setForm] = useState({
    client_id: '',
    service_type: 'صيانة مصاعد سنوية',
    title: '',
    total_amount: '',
    payment_frequency: 'monthly',
    payment_method: 'cash',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    branch: 'mecca',
    notes: '',
    quotation_id: null
  });

  // Dynamic Installments
  const [installments, setInstallments] = useState([]);

  useEffect(() => {
    fetchContracts();
    fetchClients();
    fetchServices();
  }, []);

  async function fetchContracts() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contracts')
        .select('*, clients(name, phone, city)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContracts(data || []);

      // Fetch pending accepted quotations (accepted quotes that don't have a contract yet)
      const { data: acceptedQuotes } = await supabase
        .from('quotations')
        .select('*, clients(name, phone, city)')
        .eq('status', 'accepted');

      const activeQuoteIds = data ? data.map(c => c.quotation_id).filter(Boolean) : [];
      const pending = acceptedQuotes ? acceptedQuotes.filter(q => !activeQuoteIds.includes(q.id)) : [];
      setPendingQuotations(pending);

    } catch (err) {
      console.error('خطأ في جلب العقود:', err);
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
        .select('id, name, price')
        .order('name');
      if (error) throw error;
      setServices(data || []);
    } catch (err) {
      console.error('خطأ في جلب الخدمات:', err);
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
      console.error('خطأ في جلب جدول التحصيل:', err);
    } finally {
      setLoadingSchedule(false);
    }
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

  // Generate Proposed Dates based on start date, end date, and frequency
  function generateProposedDates(startDate, endDate, frequency) {
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

  // Handle auto generation of proposed installments
  function handleGenerateProposed() {
    if (!form.total_amount || !form.start_date || !form.end_date) {
      alert('يرجى تعبئة المبلغ الكلي وتاريخ البداية والنهاية أولاً');
      return;
    }
    const dates = generateProposedDates(form.start_date, form.end_date, form.payment_frequency);
    const total = parseFloat(form.total_amount) || 0;
    const count = dates.length;
    const instAmt = count > 0 ? total / count : total;
    const instPct = count > 0 ? 100 / count : 100;

    const proposed = dates.map((date, idx) => ({
      id: idx + Date.now(),
      due_date: date.toISOString().split('T')[0],
      amount: (Math.round(instAmt * 100) / 100).toFixed(2),
      percentage: (Math.round(instPct * 10) / 10).toFixed(1),
      collected: idx === 0 // default first installment to collected immediately
    }));
    setInstallments(proposed);
  }

  // Add a blank installment row
  function handleAddInstallmentRow() {
    setInstallments(prev => [
      ...prev,
      {
        id: Date.now(),
        due_date: form.start_date,
        amount: '0.00',
        percentage: '0.0',
        collected: false
      }
    ]);
  }

  // Remove an installment row
  function handleRemoveInstallmentRow(id) {
    setInstallments(prev => prev.filter(item => item.id !== id));
  }

  // Handle dynamic edits inside installments table
  function handleInstallmentEdit(id, field, value) {
    setInstallments(prev => prev.map(item => {
      if (item.id !== id) return item;

      const total = parseFloat(form.total_amount) || 1;
      let updated = { ...item, [field]: value };

      if (field === 'amount') {
        const amt = parseFloat(value) || 0;
        updated.percentage = ((amt / total) * 100).toFixed(1);
      } else if (field === 'percentage') {
        const pct = parseFloat(value) || 0;
        updated.amount = ((pct / 100) * total).toFixed(2);
      }

      return updated;
    }));
  }

  // Stats
  const activeContracts = contracts.filter(c => c.status === 'active').length;
  const completedContracts = contracts.filter(c => c.status === 'completed' || c.status === 'cancelled').length;
  const totalValue = contracts
    .filter(c => c.status === 'active')
    .reduce((sum, c) => sum + (parseFloat(c.total_amount) || 0), 0);

  // Filtered contracts
  const filteredContracts = contracts.filter(c => {
    if (filterStatus && c.status !== filterStatus) return false;
    if (filterCity && c.branch !== filterCity) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const clientName = (c.clients?.name || '').toLowerCase();
      const contractNum = (c.contract_number || '').toLowerCase();
      const service = (c.service_type || '').toLowerCase();
      if (!clientName.includes(term) && !contractNum.includes(term) && !service.includes(term)) return false;
    }
    return true;
  });

  // Badges maps
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

      await logActivity(
        profile?.id,
        profile?.full_name,
        'إلغاء عقد',
        'contracts',
        cancellingContract.id,
        `تم إلغاء العقد رقم ${cancellingContract.contract_number} للعميل ${cancellingContract.clients?.name || ''}`,
        cancellingContract.branch
      );

      setShowCancelModal(false);
      setCancellingContract(null);
      fetchContracts();
    } catch (err) {
      console.error('خطأ في إلغاء العقد:', err);
    } finally {
      setSaving(false);
    }
  }

  // Open Direct Add Modal
  function openAddModal() {
    setForm({
      client_id: '',
      service_type: 'صيانة مصاعد سنوية',
      title: '',
      total_amount: '',
      payment_frequency: 'monthly',
      payment_method: 'cash',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      branch: 'mecca',
      notes: '',
      quotation_id: null
    });
    setInstallments([]);
    setShowAddModal(true);
  }

  // Open and Prefill Add Modal from Pending Quotation
  function activateQuotationContract(quote) {
    setForm({
      client_id: quote.client_id,
      service_type: quote.service_type || 'صيانة مصاعد سنوية',
      title: `عقد: ${quote.title}`,
      total_amount: quote.amount || '',
      payment_frequency: 'quarterly',
      payment_method: 'cash',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      branch: quote.branch || 'mecca',
      notes: quote.description || '',
      quotation_id: quote.id
    });
    setInstallments([]);
    setShowAddModal(true);
  }

  // Save Direct Contract + Installments Customization
  async function handleSaveContract(e) {
    e.preventDefault();
    if (!form.client_id || !form.total_amount || !form.start_date || !form.end_date) return;

    if (installments.length === 0) {
      alert('يرجى توليد أو إضافة دفعات العقد أولاً');
      return;
    }

    const sumInstallments = installments.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    if (Math.abs(sumInstallments - parseFloat(form.total_amount)) > 1) {
      alert(`إجمالي مبالغ الدفعات (${sumInstallments.toFixed(2)}) لا يتطابق مع إجمالي قيمة العقد (${parseFloat(form.total_amount).toFixed(2)})`);
      return;
    }

    try {
      setSaving(true);
      const contractNumber = `CT-${Date.now().toString().slice(-8)}`;

      // 1. Insert contract record
      const { data: newContract, error: contractErr } = await supabase
        .from('contracts')
        .insert({
          contract_number: contractNumber,
          client_id: form.client_id,
          quotation_id: form.quotation_id || null,
          service_type: form.service_type,
          title: form.title || `عقد مصاعد للعميل #${form.client_id.slice(0, 4)}`,
          total_amount: parseFloat(form.total_amount),
          payment_frequency: form.payment_frequency,
          payment_method: form.payment_method,
          start_date: form.start_date,
          end_date: form.end_date,
          status: 'active',
          branch: form.branch,
          notes: form.notes || null,
          created_by: profile?.id
        })
        .select()
        .single();

      if (contractErr) throw contractErr;

      // 2. Insert installments into collection_schedule
      const scheduleRows = installments.map(item => ({
        contract_id: newContract.id,
        client_id: form.client_id,
        due_date: item.due_date,
        amount: parseFloat(item.amount),
        collected_amount: item.collected ? parseFloat(item.amount) : 0,
        status: item.collected ? 'collected' : 'pending',
        branch: form.branch
      }));

      const { data: savedSchedules, error: schedErr } = await supabase
        .from('collection_schedule')
        .insert(scheduleRows)
        .select();

      if (schedErr) throw schedErr;

      // 3. For any installment marked as collected immediately:
      // Insert into collections, insert into revenues, log collection
      let immediateCollectedTotal = 0;

      for (let i = 0; i < installments.length; i++) {
        const item = installments[i];
        if (item.collected) {
          const amt = parseFloat(item.amount);
          immediateCollectedTotal += amt;
          const correspondingSchedule = savedSchedules.find(s => s.due_date === item.due_date);

          // a. Insert collection
          await supabase.from('collections').insert({
            schedule_id: correspondingSchedule?.id || null,
            contract_id: newContract.id,
            client_id: form.client_id,
            amount: amt,
            payment_method: form.payment_method,
            collection_date: form.start_date,
            receipt_number: `REC-${Date.now().toString().slice(-6)}`,
            notes: `تحصيل دفعة أولى مستلمة فوراً عند التوقيع`,
            collected_by: profile?.id,
            collected_by_name: profile?.full_name,
            branch: form.branch
          });

          // b. Insert revenue record
          await supabase.from('revenues').insert({
            amount: amt,
            description: `دفعة تعاقد مستلمة فوراً - عقد رقم ${contractNumber}`,
            revenue_date: form.start_date,
            branch: form.branch,
            client_id: form.client_id,
            created_by: profile?.id,
            created_by_name: profile?.full_name
          });
        }
      }

      // 4. Update quotation status to 'accepted' if from quotation
      if (form.quotation_id) {
        await supabase
          .from('quotations')
          .update({ status: 'accepted' })
          .eq('id', form.quotation_id);
      }

      // 5. Update client's total_due (add only the pending/uncollected amount)
      const totalAmount = parseFloat(form.total_amount);
      const netClientDueAmount = totalAmount - immediateCollectedTotal;

      if (netClientDueAmount > 0) {
        const { data: clientData } = await supabase
          .from('clients')
          .select('total_due')
          .eq('id', form.client_id)
          .single();

        if (clientData) {
          const newTotalDue = (parseFloat(clientData.total_due) || 0) + netClientDueAmount;
          await supabase
            .from('clients')
            .update({ total_due: newTotalDue })
            .eq('id', form.client_id);
        }
      }

      // 6. Log activity
      await logActivity(
        profile?.id,
        profile?.full_name,
        'إنشاء عقد',
        'contracts',
        newContract.id,
        `إنشاء عقد جديد مباشرة رقم ${contractNumber} بقيمة ${formatCurrency(totalAmount)} ${immediateCollectedTotal > 0 ? `(تم استلام ${formatCurrency(immediateCollectedTotal)} دفعة معجلة)` : ''}`,
        form.branch
      );

      // 7. Fire notification to Telegram
      const { data: clientInfo } = await supabase.from('clients').select('name').eq('id', form.client_id).single();
      await notifyIntegrations({
        title: 'عقد جديد مبرم',
        message: `تم توقيع وإبرام عقد مصاعد جديد للعميل: ${clientInfo?.name || ''}\nرقم العقد: ${contractNumber}`,
        amount: formatCurrency(totalAmount),
        branch: CITIES[form.branch] || form.branch,
        link: '/contracts'
      });

      setShowAddModal(false);
      setInstallments([]);
      fetchContracts();
    } catch (err) {
      console.error('خطأ في حفظ العقد:', err);
      alert('حدث خطأ أثناء حفظ قيد العقد المالي');
    } finally {
      setSaving(false);
    }
  }

  // Trigger high-quality vector print PDF export
  function triggerPrint(contract) {
    setPrintItem(contract);
    // Fetch schedule for printing to display complete installment list
    supabase
      .from('collection_schedule')
      .select('*')
      .eq('contract_id', contract.id)
      .order('due_date', { ascending: true })
      .then(({ data }) => {
        setPrintItem(prev => ({
          ...prev,
          schedule: data || []
        }));
        setTimeout(() => {
          window.print();
        }, 300);
      });
  }

  const sumInstallments = installments.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const isMatch = Math.abs(sumInstallments - (parseFloat(form.total_amount) || 0)) < 0.1;

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">
          <span className="title-icon" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
            <FileText size={24} />
          </span>
          العقود
        </h1>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openAddModal}>
            <Plus size={18} />
            إضافة عقد جديد
          </button>
        </div>
      </div>

      {/* Tabs bar */}
      <div className="tabs mb-24">
        <button
          className={`tab ${activeTab === 'contracts' ? 'active' : ''}`}
          onClick={() => setActiveTab('contracts')}
        >
          جميع العقود
        </button>
        <button
          className={`tab ${activeTab === 'pending' ? 'active' : ''}`}
          style={{ position: 'relative' }}
          onClick={() => setActiveTab('pending')}
        >
          عقود معلقة (من عروض الأسعار)
          {pendingQuotations.length > 0 && (
            <span className="nav-badge" style={{ position: 'absolute', top: '-4px', left: '-12px' }}>
              {pendingQuotations.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'pending' ? (
        /* Pending / Approved Quotations waiting activation */
        <div className="table-container">
          {pendingQuotations.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">⏳</div>
              <h3>لا توجد عروض أسعار معلقة</h3>
              <p>عند موافقة العميل على عرض سعر في موديول عروض الأسعار، سيظهر هنا مباشرة بانتظار استكمال بنود العقد.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>رقم عرض السعر</th>
                  <th>العميل</th>
                  <th>عنوان عرض السعر</th>
                  <th>القيمة المقترحة</th>
                  <th>الفرع</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {pendingQuotations.map(quote => (
                  <tr key={quote.id}>
                    <td>{quote.quotation_number}</td>
                    <td>{quote.clients?.name}</td>
                    <td>{quote.title}</td>
                    <td><strong>{formatCurrency(quote.amount)}</strong></td>
                    <td>{CITIES[quote.branch] || quote.branch}</td>
                    <td>
                      <span className="badge badge-warning">متوافق عليه ومثبت</span>
                    </td>
                    <td>
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => activateQuotationContract(quote)}
                      >
                        <Check size={14} />
                        تفعيل وإبرام العقد
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        /* Regular Contracts List */
        <>
          {/* Stats Grid */}
          <div className="stats-grid">
            <div className="stat-card success">
              <div className="stat-info">
                <div className="stat-label">عقود نشطة</div>
                <div className="stat-value">{activeContracts}</div>
              </div>
              <div className="stat-icon success">
                <FileText size={24} />
              </div>
            </div>

            <div className="stat-card warning">
              <div className="stat-info">
                <div className="stat-label">عقود منتهية</div>
                <div className="stat-value">{completedContracts}</div>
              </div>
              <div className="stat-icon warning">
                <Calendar size={24} />
              </div>
            </div>

            <div className="stat-card primary">
              <div className="stat-info">
                <div className="stat-label">إجمالي القيمة</div>
                <div className="stat-value">{formatCurrency(totalValue)}</div>
              </div>
              <div className="stat-icon primary">
                <DollarSign size={24} />
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="filter-bar">
            <div className="filter-group">
              <Filter size={18} />
              <select
                className="form-select"
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
              >
                <option value="">كل الحالات</option>
                {Object.entries(CONTRACT_STATUS).map(([key, val]) => (
                  <option key={key} value={key}>{val}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <select
                className="form-select"
                value={filterCity}
                onChange={e => setFilterCity(e.target.value)}
              >
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
                placeholder="بحث بالعميل أو رقم العقد..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Data Table */}
          <div className="table-container">
            {filteredContracts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📄</div>
                <h3>لا توجد عقود</h3>
                <p>لم يتم العثور على عقود مطابقة للبحث</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>رقم العقد</th>
                    <th>العميل</th>
                    <th>الخدمة</th>
                    <th>القيمة</th>
                    <th>طريقة الدفع</th>
                    <th>الفترة</th>
                    <th>تاريخ البداية</th>
                    <th>الحالة</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContracts.map(contract => (
                    <>
                      <tr key={contract.id}>
                        <td>
                          <strong>{contract.contract_number || '-'}</strong>
                        </td>
                        <td>{contract.clients?.name || '-'}</td>
                        <td>{contract.service_type || '-'}</td>
                        <td>
                          <strong>{formatCurrency(contract.total_amount)}</strong>
                        </td>
                        <td>{PAYMENT_METHODS[contract.payment_method] || contract.payment_method || '-'}</td>
                        <td>{PAYMENT_FREQUENCIES[contract.payment_frequency] || contract.payment_frequency || '-'}</td>
                        <td>{formatDate(contract.start_date)}</td>
                        <td>
                          <span className={`badge ${getStatusBadge(contract.status)}`}>
                            {CONTRACT_STATUS[contract.status] || contract.status}
                          </span>
                        </td>
                        <td>
                          <div className="quick-actions">
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => toggleExpand(contract.id)}
                              title="عرض جدول التحصيل"
                            >
                              {expandedContract === contract.id ? (
                                <ChevronUp size={16} />
                              ) : (
                                <ChevronDown size={16} />
                              )}
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => triggerPrint(contract)}
                              title="تصدير كـ PDF / طباعة"
                            >
                              <Printer size={16} className="text-primary" />
                            </button>
                            {contract.status === 'active' && (
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => openCancelModal(contract)}
                                title="إلغاء العقد"
                              >
                                <X size={16} className="text-danger" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Collection Schedule */}
                      {expandedContract === contract.id && (
                        <tr key={`schedule-${contract.id}`}>
                          <td colSpan={9}>
                            <div className="card">
                              <div className="card-header">
                                <h3 className="card-title">
                                  <Calendar size={18} />
                                  جدول التحصيل المالي لهذا العقد
                                </h3>
                              </div>
                              <div className="card-body">
                                {loadingSchedule ? (
                                  <div className="empty-state">
                                    <p>جاري التحميل...</p>
                                  </div>
                                ) : scheduleData.length === 0 ? (
                                  <div className="empty-state">
                                    <p>لا يوجد جدول تحصيل لهذا العقد</p>
                                  </div>
                                ) : (
                                  <table className="data-table">
                                    <thead>
                                      <tr>
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
                                          <tr key={item.id} className={item.status === 'overdue' ? 'table-row-danger' : ''}>
                                            <td>{formatDate(item.due_date)}</td>
                                            <td>{formatCurrency(item.amount)}</td>
                                            <td>{formatCurrency(item.collected_amount || 0)}</td>
                                            <td>
                                              <strong>{formatCurrency(remaining > 0 ? remaining : 0)}</strong>
                                            </td>
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
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Direct Add Contract Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: '850px' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                {form.quotation_id ? 'تفعيل عقد من عرض سعر مقبول' : 'إبرام عقد مالي جديد'}
              </h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveContract}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">العميل *</label>
                    <select
                      className="form-select"
                      value={form.client_id}
                      onChange={e => setForm({ ...form, client_id: e.target.value })}
                      disabled={!!form.quotation_id}
                      required
                    >
                      <option value="">اختر العميل</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">نوع الخدمة / العقد *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={form.service_type}
                      onChange={e => setForm({ ...form, service_type: e.target.value })}
                      placeholder="مثال: صيانة دورية مصاعد"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">عنوان العقد *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="مثال: عقد صيانة سنوي - فندق شيراتون مكة"
                    required
                  />
                </div>

                <div className="form-row-3">
                  <div className="form-group">
                    <label className="form-label">القيمة الإجمالية للعقد (ر.س) *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={form.total_amount}
                      onChange={e => setForm({ ...form, total_amount: e.target.value })}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">دورية الدفع المعتمدة *</label>
                    <select
                      className="form-select"
                      value={form.payment_frequency}
                      onChange={e => setForm({ ...form, payment_frequency: e.target.value })}
                      required
                    >
                      {Object.entries(PAYMENT_FREQUENCIES).map(([key, val]) => (
                        <option key={key} value={key}>{val}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">طريقة الدفع *</label>
                    <select
                      className="form-select"
                      value={form.payment_method}
                      onChange={e => setForm({ ...form, payment_method: e.target.value })}
                      required
                    >
                      {Object.entries(PAYMENT_METHODS).map(([key, val]) => (
                        <option key={key} value={key}>{val}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row-3">
                  <div className="form-group">
                    <label className="form-label">تاريخ بدء سريان العقد *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={form.start_date}
                      onChange={e => setForm({ ...form, start_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">تاريخ نهاية العقد *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={form.end_date}
                      onChange={e => setForm({ ...form, end_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">فرع العقد *</label>
                    <select
                      className="form-select"
                      value={form.branch}
                      onChange={e => setForm({ ...form, branch: e.target.value })}
                      required
                    >
                      <option value="mecca">مكة المكرمة</option>
                      <option value="jeddah">جدة</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">ملاحظات العقد</label>
                  <textarea
                    className="form-textarea"
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    placeholder="أي ملاحظات فنية أو شروط دفع إضافية..."
                    rows={2}
                  />
                </div>

                {/* dynamic installments section */}
                <div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                  <div className="flex-between mb-16">
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>تخصيص دفعات جدول التحصيل</h3>
                      <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                        قم بتوليد الدفعات المقترحة، ثم يمكنك تعديل المبالغ والنسب والتواريخ وتحديد الدفعة المستلمة معجلاً.
                      </p>
                    </div>
                    <div className="flex gap-8">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={handleGenerateProposed}
                      >
                        توليد الدفعات المقترحة
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ border: '1px solid var(--border)' }}
                        onClick={handleAddInstallmentRow}
                      >
                        إضافة دفعة مخصصة +
                      </button>
                    </div>
                  </div>

                  {installments.length > 0 ? (
                    <div className="table-container" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>دفعة استحقاق</th>
                            <th>تاريخ الاستحقاق</th>
                            <th>المبلغ المطلق (ر.س)</th>
                            <th>النسبة المئوية (%)</th>
                            <th style={{ textAlign: 'center' }}>مستلمة فوراً؟</th>
                            <th style={{ textAlign: 'center' }}>حذف</th>
                          </tr>
                        </thead>
                        <tbody>
                          {installments.map((item, idx) => (
                            <tr key={item.id}>
                              <td>دفعة #{idx + 1}</td>
                              <td>
                                <input
                                  type="date"
                                  className="form-input"
                                  style={{ padding: '6px 12px' }}
                                  value={item.due_date}
                                  onChange={e => handleInstallmentEdit(item.id, 'due_date', e.target.value)}
                                  required
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="form-input font-bold"
                                  style={{ padding: '6px 12px' }}
                                  value={item.amount}
                                  step="0.01"
                                  onChange={e => handleInstallmentEdit(item.id, 'amount', e.target.value)}
                                  required
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="form-input"
                                  style={{ padding: '6px 12px' }}
                                  value={item.percentage}
                                  step="0.1"
                                  onChange={e => handleInstallmentEdit(item.id, 'percentage', e.target.value)}
                                  required
                                />
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                  checked={item.collected}
                                  onChange={e => handleInstallmentEdit(item.id, 'collected', e.target.checked)}
                                />
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => handleRemoveInstallmentRow(item.id)}
                                >
                                  <Trash2 size={16} className="text-danger" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ padding: '20px', textAlign: 'center', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px dashed var(--border)' }}>
                      يرجى النقر على زر <strong>"توليد الدفعات المقترحة"</strong> للبدء في جدولة العقد مالياً
                    </div>
                  )}

                  {/* calculation summary */}
                  {installments.length > 0 && (
                    <div className="flex-between mt-16" style={{ background: 'var(--bg-tertiary)', padding: '12px 20px', borderRadius: '8px' }}>
                      <div>
                        مجموع المبالغ المجدولة: <strong>{formatCurrency(sumInstallments)}</strong>
                      </div>
                      <div>
                        {isMatch ? (
                          <span className="text-success flex gap-8">
                            <Check size={16} />
                            الدفعات متطابقة تماماً مع إجمالي العقد
                          </span>
                        ) : (
                          <span className="text-danger flex gap-8">
                            <ShieldAlert size={16} />
                            عدم تطابق! الفرق: {formatCurrency(sumInstallments - (parseFloat(form.total_amount) || 0))}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="submit"
                  className="btn btn-success"
                  disabled={saving || !isMatch || installments.length === 0}
                >
                  <Check size={18} />
                  {saving ? 'جاري توثيق قيد العقد...' : 'إبرام وتفعيل العقد رسمياً'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print PDF Vector Document Section (hidden on screen, visible only during print) */}
      {printItem && (
        <div className="print-only-container">
          <div className="print-header">
            <div className="print-logo-section">
              <img src="/logo-transparent.png" alt="عاصمة الكون" />
              <div>
                <h1>شركة عاصمة الكون للمصاعد</h1>
                <span style={{ fontSize: '0.85rem', color: '#555' }}>نظام إدارة موارد المؤسسة المالي المتكامل</span>
              </div>
            </div>
            <div style={{ textAlign: 'left', direction: 'ltr' }}>
              <p>رقم العقد: <strong>{printItem.contract_number}</strong></p>
              <p>تاريخ الطباعة: {new Date().toLocaleDateString('ar-SA')}</p>
            </div>
          </div>

          <div className="print-title">عقد صيانة وتشغيل مصاعد رسمي</div>

          <div className="print-meta-grid">
            <div className="print-meta-item">
              <span>اسم العميل الطرف الثاني</span>
              <strong>{printItem.clients?.name || '-'}</strong>
            </div>
            <div className="print-meta-item">
              <span>رقم هاتف العميل</span>
              <strong>{printItem.clients?.phone || '-'}</strong>
            </div>
            <div className="print-meta-item">
              <span>نوع الخدمة المتعاقد عليها</span>
              <strong>{printItem.service_type || '-'}</strong>
            </div>
            <div className="print-meta-item">
              <span>القيمة الكلية للعقد المالي</span>
              <strong>{formatCurrency(printItem.total_amount)}</strong>
            </div>
            <div className="print-meta-item">
              <span>دورية وجدولة الدفعات</span>
              <strong>{PAYMENT_FREQUENCIES[printItem.payment_frequency] || printItem.payment_frequency || '-'}</strong>
            </div>
            <div className="print-meta-item">
              <span>طريقة سداد الدفعات</span>
              <strong>{PAYMENT_METHODS[printItem.payment_method] || printItem.payment_method || '-'}</strong>
            </div>
            <div className="print-meta-item">
              <span>تاريخ بدء سريان العقد</span>
              <strong>{formatDate(printItem.start_date)}</strong>
            </div>
            <div className="print-meta-item">
              <span>تاريخ نهاية العقد</span>
              <strong>{formatDate(printItem.end_date)}</strong>
            </div>
          </div>

          {printItem.notes && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '15px', borderRadius: '8px', marginBottom: '30px' }}>
              <span style={{ fontSize: '0.85rem', color: '#64748b', display: 'block', marginBottom: '5px' }}>ملاحظات وشروط إضافية:</span>
              <p style={{ margin: 0, color: '#334155' }}>{printItem.notes}</p>
            </div>
          )}

          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '15px', color: '#1e3a8a', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px' }}>
            جدول الدفعات المالية المعتمدة للتحصيل
          </h3>

          <table className="print-table">
            <thead>
              <tr>
                <th>الدفعة المستحقة</th>
                <th>تاريخ الاستحقاق</th>
                <th>قيمة الدفعة (ر.س)</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {printItem.schedule && printItem.schedule.map((item, idx) => (
                <tr key={item.id}>
                  <td>الدفعة المستحقة #{idx + 1}</td>
                  <td>{formatDate(item.due_date)}</td>
                  <td><strong>{formatCurrency(item.amount)}</strong></td>
                  <td>
                    {item.status === 'collected' && 'تم التحصيل رسمياً'}
                    {item.status === 'pending' && 'معلقة / غير مسددة'}
                    {item.status === 'overdue' && 'متأخرة السداد'}
                    {item.status === 'partial' && 'مستلمة جزئياً'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="print-footer">
            <div className="print-signature">
              <span>الطرف الأول (الشركة)</span>
              <strong>توقيع وختم المفوض</strong>
            </div>
            <div className="print-signature">
              <span>الطرف الثاني (العميل)</span>
              <strong>توقيع الطرف الثاني</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Contracts;
