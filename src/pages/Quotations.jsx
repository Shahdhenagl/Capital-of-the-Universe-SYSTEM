import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, formatCurrency, formatDate, QUOTATION_STATUS, PAYMENT_FREQUENCIES, PAYMENT_METHODS, CITIES, logActivity } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Plus, Search, Send, Check, X, Eye, Filter, MessageCircle } from 'lucide-react';

function Quotations() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [quotations, setQuotations] = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');

  // New quotation modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    client_id: '',
    service_id: '',
    title: '',
    description: '',
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
        .select('id, name, price')
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

  function handleContractFormChange(field, value) {
    setContractForm(prev => ({ ...prev, [field]: value }));
  }

  function resetForm() {
    setForm({
      client_id: '',
      service_id: '',
      title: '',
      description: '',
      amount: '',
      branch: 'mecca',
      pdf_file: null
    });
  }

  async function handleAddQuotation(e) {
    e.preventDefault();
    if (!form.client_id || !form.title || !form.amount) return;

    try {
      setSaving(true);

      let pdfUrl = null;
      if (form.pdf_file) {
        const fileName = `quotations/${Date.now()}_${form.pdf_file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, form.pdf_file);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('documents')
          .getPublicUrl(fileName);
        pdfUrl = urlData?.publicUrl || null;
      }

      const quotationNumber = `QT-${Date.now().toString().slice(-8)}`;

      const { data, error } = await supabase
        .from('quotations')
        .insert({
          quotation_number: quotationNumber,
          client_id: form.client_id,
          service_id: form.service_id || null,
          title: form.title,
          description: form.description || null,
          amount: parseFloat(form.amount),
          branch: form.branch,
          status: 'pending',
          pdf_url: pdfUrl,
          created_by: profile?.id
        })
        .select()
        .single();

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

      resetForm();
      setShowAddModal(false);
      fetchQuotations();
    } catch (err) {
      console.error('خطأ في إنشاء عرض السعر:', err);
      alert('حدث خطأ أثناء إنشاء عرض السعر');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(quotation, newStatus) {
    if (newStatus === 'accepted') {
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
      alert('حدث خطأ أثناء قبول عرض السعر وإنشاء العقد');
    } finally {
      setSavingContract(false);
    }
  }

  function sendWhatsApp(quotation) {
    const clientPhone = quotation.clients?.phone || '';
    const phone = clientPhone.replace(/^0/, '966');
    const message = encodeURIComponent(
      `مرحباً،\n` +
      `نود إبلاغكم بعرض السعر التالي من شركة عاصمة الكون:\n\n` +
      `📋 العنوان: ${quotation.title || ''}\n` +
      `💰 المبلغ: ${formatCurrency(quotation.amount)}\n` +
      `📅 التاريخ: ${formatDate(quotation.created_at)}\n\n` +
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
            className={`city-filter-btn ${statusFilter === 'pending' ? 'active' : ''}`}
            onClick={() => setStatusFilter('pending')}
          >
            معلق
          </button>
          <button
            className={`city-filter-btn ${statusFilter === 'accepted' ? 'active' : ''}`}
            onClick={() => setStatusFilter('accepted')}
          >
            مقبول
          </button>
          <button
            className={`city-filter-btn ${statusFilter === 'rejected' ? 'active' : ''}`}
            onClick={() => setStatusFilter('rejected')}
          >
            مرفوض
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
                    <span className={`badge ${getStatusBadgeClass(q.status)}`}>
                      {QUOTATION_STATUS[q.status] || q.status}
                    </span>
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
                        onClick={() => sendWhatsApp(q)}
                        title="إرسال عبر واتساب"
                      >
                        <MessageCircle size={16} className="text-success" />
                      </button>
                      {q.status === 'pending' && (
                        <>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleStatusChange(q, 'accepted')}
                            title="قبول"
                          >
                            <Check size={16} className="text-success" />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleStatusChange(q, 'rejected')}
                            title="رفض"
                          >
                            <X size={16} className="text-danger" />
                          </button>
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
                    <select
                      className="form-select"
                      value={form.client_id}
                      onChange={(e) => handleFormChange('client_id', e.target.value)}
                      required
                    >
                      <option value="">اختر العميل</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>
                      ))}
                    </select>
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
                  <input
                    type="text"
                    className="form-input"
                    value={form.title}
                    onChange={(e) => handleFormChange('title', e.target.value)}
                    placeholder="مثال: صيانة مصاعد سنوية"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">الوصف</label>
                  <textarea
                    className="form-textarea"
                    value={form.description}
                    onChange={(e) => handleFormChange('description', e.target.value)}
                    placeholder="تفاصيل عرض السعر..."
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
    </div>
  );
}

export default Quotations;
