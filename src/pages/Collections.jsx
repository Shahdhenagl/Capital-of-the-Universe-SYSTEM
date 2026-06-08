import { useState, useEffect } from 'react';
import { supabase, formatCurrency, formatDate, CITIES, COLLECTION_STATUS, PAYMENT_METHODS, logActivity } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Wallet, DollarSign, Calendar, AlertCircle, Check, Search, X, Filter, Download, MessageCircle, UploadCloud } from 'lucide-react';
import { appendGoogleSheet, downloadCsv, notifyIntegrations, openWhatsApp, uploadDriveTextFile } from '../lib/integrations';
import { notifyCollectionReceived } from '../lib/whatsapp';

function parsePaymentNote(notes, fallbackLabel = 'دفعة') {
  if (!notes) return { label: fallbackLabel, description: '' };
  try {
    const parsed = JSON.parse(notes);
    if (parsed && typeof parsed === 'object') {
      return {
        label: parsed.label || fallbackLabel,
        description: parsed.description || ''
      };
    }
  } catch {
    // Legacy rows stored the payment label as plain text.
  }
  return { label: notes, description: '' };
}

function Collections({ cityFilter = 'all' }) {
  const { profile } = useAuth();

  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [saving, setSaving] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Collection form
  const [collectForm, setCollectForm] = useState({
    amount: '',
    payment_method: 'cash',
    collection_date: new Date().toISOString().split('T')[0],
    receipt_number: '',
    notes: ''
  });

  useEffect(() => {
    markOverdue();
    fetchSchedules();
  }, []);

  useEffect(() => {
    setFilterCity(cityFilter === 'all' ? '' : cityFilter);
  }, [cityFilter]);

  async function markOverdue() {
    try {
      const today = new Date().toISOString().split('T')[0];
      await supabase
        .from('collection_schedule')
        .update({ status: 'overdue' })
        .eq('status', 'pending')
        .lt('due_date', today);
    } catch (err) {
      console.error('خطأ في تحديث المتأخرات:', err);
    }
  }

  async function fetchSchedules() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('collection_schedule')
        .select('*, clients(name, phone), contracts(contract_number)')
        .order('due_date', { ascending: false });

      if (error) throw error;
      setSchedules(data || []);
    } catch (err) {
      console.error('خطأ في جلب جدول التحصيلات:', err);
    } finally {
      setLoading(false);
    }
  }

  // Stats calculations
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const dueToday = schedules
    .filter(s => s.due_date === today && s.status !== 'collected')
    .reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);

  const dueThisMonth = schedules
    .filter(s => {
      const d = new Date(s.due_date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear && s.status !== 'collected';
    })
    .reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);

  const totalCollected = schedules
    .filter(s => s.status === 'collected' || s.status === 'partial')
    .reduce((sum, s) => sum + (parseFloat(s.collected_amount) || 0), 0);

  const totalOverdue = schedules
    .filter(s => s.status === 'overdue')
    .reduce((sum, s) => sum + ((parseFloat(s.amount) || 0) - (parseFloat(s.collected_amount) || 0)), 0);

  // Filtered schedules
  const filteredSchedules = schedules.filter(s => {
    if (filterStatus && s.status !== filterStatus) return false;
    if (filterCity && s.branch !== filterCity) return false;
    if (filterDateFrom && s.due_date < filterDateFrom) return false;
    if (filterDateTo && s.due_date > filterDateTo) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const clientName = (s.clients?.name || '').toLowerCase();
      const contractNum = (s.contracts?.contract_number || '').toLowerCase();
      const paymentNote = parsePaymentNote(s.notes, '').label.toLowerCase();
      const paymentDescription = parsePaymentNote(s.notes, '').description.toLowerCase();
      if (!clientName.includes(term) && !contractNum.includes(term) && !paymentNote.includes(term) && !paymentDescription.includes(term)) return false;
    }
    return true;
  });

  function getStatusBadge(status) {
    const map = {
      pending: 'badge-warning',
      collected: 'badge-success',
      overdue: 'badge-danger',
      partial: 'badge-info'
    };
    return map[status] || 'badge-secondary';
  }

  function openCollectModal(schedule) {
    setSelectedSchedule(schedule);
    const remaining = (parseFloat(schedule.amount) || 0) - (parseFloat(schedule.collected_amount) || 0);
    setCollectForm({
      amount: remaining > 0 ? remaining.toFixed(2) : '',
      payment_method: 'cash',
      collection_date: new Date().toISOString().split('T')[0],
      receipt_number: '',
      notes: ''
    });
    setShowCollectModal(true);
  }

  function getExportRows() {
    return filteredSchedules.map(schedule => ({
      payment: parsePaymentNote(schedule.notes, '').label,
      payment_description: parsePaymentNote(schedule.notes, '').description,
      client: schedule.clients?.name || '',
      phone: schedule.clients?.phone || '',
      contract: schedule.contracts?.contract_number || '',
      due_date: schedule.due_date || '',
      amount: schedule.amount || 0,
      collected_amount: schedule.collected_amount || 0,
      status: COLLECTION_STATUS[schedule.status] || schedule.status || '',
      branch: CITIES[schedule.branch] || schedule.branch || ''
    }));
  }

  function exportCollectionsCsv() {
    const rows = getExportRows();
    if (rows.length) downloadCsv(`collections-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  async function exportCollectionsToGoogle() {
    const rows = getExportRows();
    if (!rows.length) return;
    try {
      await appendGoogleSheet('Collections', rows);
      await uploadDriveTextFile(
        `collections-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(rows, null, 2),
        'application/json'
      );
      alert('تم إرسال التقرير إلى Google Sheets/Drive إذا كانت المفاتيح مفعلة على Vercel');
    } catch (err) {
      console.error('Google export failed:', err);
      alert('تعذر إرسال التقرير إلى Google. راجعي مفاتيح Google في Vercel.');
    }
  }

  function sendCollectionReminder(schedule) {
    const remaining = (parseFloat(schedule.amount) || 0) - (parseFloat(schedule.collected_amount) || 0);
    openWhatsApp(
      schedule.clients?.phone,
      `مرحباً ${schedule.clients?.name || ''}،\n` +
      `نذكركم بموعد تحصيل مستحق لشركة عاصمة الكون.\n` +
      `رقم العقد: ${schedule.contracts?.contract_number || '-'}\n` +
      `تاريخ الاستحقاق: ${formatDate(schedule.due_date)}\n` +
      `المبلغ المتبقي: ${formatCurrency(remaining)}\n` +
      `شكراً لكم.`
    );
  }

  async function handleCollect(e) {
    e.preventDefault();
    if (!selectedSchedule || !collectForm.amount) return;

    try {
      setSaving(true);
      const collectedAmount = parseFloat(collectForm.amount);
      const previousCollected = parseFloat(selectedSchedule.collected_amount) || 0;
      const totalNowCollected = previousCollected + collectedAmount;
      const amountDue = parseFloat(selectedSchedule.amount) || 0;

      // Determine new status
      let newStatus = 'partial';
      if (totalNowCollected >= amountDue) {
        newStatus = 'collected';
      }

      // 1. Insert collection record
      const { error: collError } = await supabase
        .from('collections')
        .insert({
          schedule_id: selectedSchedule.id,
          contract_id: selectedSchedule.contract_id,
          client_id: selectedSchedule.client_id,
          amount: collectedAmount,
          payment_method: collectForm.payment_method,
          collection_date: collectForm.collection_date,
          receipt_number: collectForm.receipt_number || null,
          notes: collectForm.notes || null,
          collected_by: profile?.id,
          collected_by_name: profile?.full_name,
          branch: selectedSchedule.branch
        });

      if (collError) throw collError;

      // 2. Update collection_schedule
      const { error: schedError } = await supabase
        .from('collection_schedule')
        .update({
          collected_amount: totalNowCollected,
          status: newStatus
        })
        .eq('id', selectedSchedule.id);

      if (schedError) throw schedError;

      // 3. Update client total_due (decrease)
      if (selectedSchedule.client_id) {
        const { data: clientData } = await supabase
          .from('clients')
          .select('total_due')
          .eq('id', selectedSchedule.client_id)
          .single();

        if (clientData) {
          const newTotalDue = Math.max(0, (parseFloat(clientData.total_due) || 0) - collectedAmount);
          await supabase
            .from('clients')
            .update({ total_due: newTotalDue })
            .eq('id', selectedSchedule.client_id);
        }
      }

      // 4. Add to revenues
      await supabase
        .from('revenues')
        .insert({
          amount: collectedAmount,
          description: `تحصيل دفعة - عقد ${selectedSchedule.contracts?.contract_number || ''} - ${selectedSchedule.clients?.name || ''}`,
          revenue_date: collectForm.collection_date,
          branch: selectedSchedule.branch,
          client_id: selectedSchedule.client_id,
          created_by: profile?.id,
          created_by_name: profile?.full_name
        });

      // 5. Log activity
      await logActivity(
        profile?.id,
        profile?.full_name,
        'تسجيل تحصيل',
        'collections',
        selectedSchedule.id,
        `تحصيل مبلغ ${formatCurrency(collectedAmount)} من ${selectedSchedule.clients?.name || 'عميل'} - عقد ${selectedSchedule.contracts?.contract_number || ''}`,
        selectedSchedule.branch
      );

      await notifyIntegrations({
        title: 'تحصيل جديد',
        message: `تم تسجيل تحصيل من ${selectedSchedule.clients?.name || 'عميل'} لعقد ${selectedSchedule.contracts?.contract_number || '-'}`,
        actor: profile?.full_name || profile?.email,
        amount: formatCurrency(collectedAmount),
        branch: CITIES[selectedSchedule.branch] || selectedSchedule.branch,
        link: '/collections',
        whatsapp: true
      });

      // Send WhatsApp Notification to the client
      if (selectedSchedule.clients?.phone) {
        // Calculate remaining balance after this payment
        const remainingBalance = Math.max(0, amountDue - totalNowCollected);
        await notifyCollectionReceived(
          selectedSchedule.clients.phone, 
          collectedAmount, 
          collectForm.receipt_number || 'N/A', 
          remainingBalance
        );
      }

      setShowCollectModal(false);
      setSelectedSchedule(null);
      fetchSchedules();
    } catch (err) {
      console.error('خطأ في تسجيل التحصيل:', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">
          <span className="title-icon" style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}>
            <Wallet size={24} />
          </span>
          التحصيلات
        </h1>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={exportCollectionsCsv}>
            <Download size={18} />
            CSV
          </button>
          <button className="btn btn-primary" onClick={exportCollectionsToGoogle}>
            <UploadCloud size={18} />
            Google
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card warning">
          <div className="stat-info">
            <div className="stat-label">مستحق اليوم</div>
            <div className="stat-value">{formatCurrency(dueToday)}</div>
          </div>
          <div className="stat-icon warning">
            <Calendar size={24} />
          </div>
        </div>

        <div className="stat-card info">
          <div className="stat-info">
            <div className="stat-label">مستحق هذا الشهر</div>
            <div className="stat-value">{formatCurrency(dueThisMonth)}</div>
          </div>
          <div className="stat-icon info">
            <DollarSign size={24} />
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-info">
            <div className="stat-label">إجمالي المحصل</div>
            <div className="stat-value">{formatCurrency(totalCollected)}</div>
          </div>
          <div className="stat-icon success">
            <Check size={24} />
          </div>
        </div>

        <div className="stat-card danger">
          <div className="stat-info">
            <div className="stat-label">متأخر</div>
            <div className="stat-value">{formatCurrency(totalOverdue)}</div>
          </div>
          <div className="stat-icon danger">
            <AlertCircle size={24} />
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
            <option value="">الكل</option>
            {Object.entries(COLLECTION_STATUS).map(([key, val]) => (
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

        <div className="filter-group">
          <input
            type="date"
            className="form-input"
            value={filterDateFrom}
            onChange={e => setFilterDateFrom(e.target.value)}
            placeholder="من تاريخ"
          />
        </div>

        <div className="filter-group">
          <input
            type="date"
            className="form-input"
            value={filterDateTo}
            onChange={e => setFilterDateTo(e.target.value)}
            placeholder="إلى تاريخ"
          />
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
        {loading ? (
          <div className="empty-state">
            <p>جاري التحميل...</p>
          </div>
        ) : filteredSchedules.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">$</div>
            <h3>لا توجد تحصيلات</h3>
            <p>لم يتم العثور على تحصيلات مطابقة للبحث</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>العميل</th>
                <th>رقم العقد</th>
                <th>الدفعة</th>
                <th>تاريخ الاستحقاق</th>
                <th>المبلغ المستحق</th>
                <th>المبلغ المحصل</th>
                <th>الحالة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredSchedules.map(schedule => {
                const remaining = (parseFloat(schedule.amount) || 0) - (parseFloat(schedule.collected_amount) || 0);
                const paymentNote = parsePaymentNote(schedule.notes, '-');
                return (
                  <tr key={schedule.id} className={schedule.status === 'overdue' ? 'table-row-danger' : ''}>
                    <td>
                      <strong>{schedule.clients?.name || '-'}</strong>
                    </td>
                    <td>{schedule.contracts?.contract_number || '-'}</td>
                    <td>
                      <strong>{paymentNote.label}</strong>
                      {paymentNote.description && <p className="text-muted mt-4" style={{ marginBottom: 0 }}>{paymentNote.description}</p>}
                    </td>
                    <td>{formatDate(schedule.due_date)}</td>
                    <td>{formatCurrency(schedule.amount)}</td>
                    <td>{formatCurrency(schedule.collected_amount || 0)}</td>
                    <td>
                      <span className={`badge ${getStatusBadge(schedule.status)}`}>
                        {COLLECTION_STATUS[schedule.status] || schedule.status}
                      </span>
                    </td>
                    <td>
                      {schedule.status !== 'collected' && (
                        <div className="quick-actions">
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => openCollectModal(schedule)}
                          >
                            <Check size={14} />
                            تسجيل تحصيل
                          </button>
                          <button
                            className="btn btn-whatsapp btn-sm"
                            onClick={() => sendCollectionReminder(schedule)}
                            disabled={!schedule.clients?.phone}
                          >
                            <MessageCircle size={14} />
                            تذكير
                          </button>
                        </div>
                      )}
                      {schedule.status === 'collected' && (
                        <span className="badge badge-success">
                          <Check size={12} />
                          تم التحصيل
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Collection Modal */}
      {showCollectModal && selectedSchedule && (
        <div className="modal-overlay" onClick={() => setShowCollectModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">تسجيل تحصيل</h2>
              <button className="modal-close" onClick={() => setShowCollectModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCollect}>
              <div className="modal-body">
                {/* Schedule info */}
                <div className="card" style={{ marginBottom: '20px' }}>
                  <div className="card-body">
                    <div className="form-row">
                      <div>
                        <span className="form-label">العميل:</span>
                        <strong> {selectedSchedule.clients?.name || '-'}</strong>
                      </div>
                      <div>
                        <span className="form-label">رقم العقد:</span>
                        <strong> {selectedSchedule.contracts?.contract_number || '-'}</strong>
                      </div>
                    </div>
                    <div className="form-row" style={{ marginTop: '12px' }}>
                      <div>
                        <span className="form-label">المبلغ المستحق:</span>
                        <strong> {formatCurrency(selectedSchedule.amount)}</strong>
                      </div>
                      <div>
                        <span className="form-label">المتبقي:</span>
                        <strong> {formatCurrency((parseFloat(selectedSchedule.amount) || 0) - (parseFloat(selectedSchedule.collected_amount) || 0))}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">المبلغ المحصل *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={collectForm.amount}
                      onChange={e => setCollectForm({ ...collectForm, amount: e.target.value })}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">طريقة الدفع *</label>
                    <select
                      className="form-select"
                      value={collectForm.payment_method}
                      onChange={e => setCollectForm({ ...collectForm, payment_method: e.target.value })}
                      required
                    >
                      {Object.entries(PAYMENT_METHODS).map(([key, val]) => (
                        <option key={key} value={key}>{val}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">تاريخ التحصيل *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={collectForm.collection_date}
                      onChange={e => setCollectForm({ ...collectForm, collection_date: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">رقم الإيصال</label>
                    <input
                      type="text"
                      className="form-input"
                      value={collectForm.receipt_number}
                      onChange={e => setCollectForm({ ...collectForm, receipt_number: e.target.value })}
                      placeholder="رقم الإيصال..."
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">ملاحظات</label>
                  <textarea
                    className="form-textarea"
                    value={collectForm.notes}
                    onChange={e => setCollectForm({ ...collectForm, notes: e.target.value })}
                    placeholder="ملاحظات إضافية..."
                    rows={3}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="submit" className="btn btn-success" disabled={saving}>
                  {saving ? 'جاري الحفظ...' : 'تسجيل التحصيل'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCollectModal(false)}
                >
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

export default Collections;

