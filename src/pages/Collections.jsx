import { useState, useEffect } from 'react';
import { supabase, formatCurrency, formatDate, CITIES, COLLECTION_STATUS, PAYMENT_METHODS, logActivity } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Wallet, DollarSign, Calendar, AlertCircle, Check, Search, X, Filter, Download, MessageCircle, UploadCloud } from 'lucide-react';
import { appendGoogleSheet, downloadCsv, notifyIntegrations, openWhatsApp, uploadDriveTextFile } from '../lib/integrations';

function Collections() {
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

  async function markOverdue() {
    try {
      const today = new Date().toISOString().split('T')[0];
      await supabase
        .from('collection_schedule')
        .update({ status: 'overdue' })
        .eq('status', 'pending')
        .lt('due_date', today);
    } catch (err) {
      console.error('Ø®Ø·Ø£ ÙÙŠ ØªØ­Ø¯ÙŠØ« Ø§Ù„Ù…ØªØ£Ø®Ø±Ø§Øª:', err);
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
      console.error('Ø®Ø·Ø£ ÙÙŠ Ø¬Ù„Ø¨ Ø¬Ø¯ÙˆÙ„ Ø§Ù„ØªØ­ØµÙŠÙ„Ø§Øª:', err);
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
      if (!clientName.includes(term) && !contractNum.includes(term)) return false;
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
      alert('ØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„ØªÙ‚Ø±ÙŠØ± Ø¥Ù„Ù‰ Google Sheets/Drive Ø¥Ø°Ø§ ÙƒØ§Ù†Øª Ø§Ù„Ù…ÙØ§ØªÙŠØ­ Ù…ÙØ¹Ù„Ø© Ø¹Ù„Ù‰ Vercel');
    } catch (err) {
      console.error('Google export failed:', err);
      alert('ØªØ¹Ø°Ø± Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„ØªÙ‚Ø±ÙŠØ± Ø¥Ù„Ù‰ Google. Ø±Ø§Ø¬Ø¹ÙŠ Ù…ÙØ§ØªÙŠØ­ Google ÙÙŠ Vercel.');
    }
  }

  function sendCollectionReminder(schedule) {
    const remaining = (parseFloat(schedule.amount) || 0) - (parseFloat(schedule.collected_amount) || 0);
    openWhatsApp(
      schedule.clients?.phone,
      `Ù…Ø±Ø­Ø¨Ø§Ù‹ ${schedule.clients?.name || ''}ØŒ\n` +
      `Ù†Ø°ÙƒØ±ÙƒÙ… Ø¨Ù…ÙˆØ¹Ø¯ ØªØ­ØµÙŠÙ„ Ù…Ø³ØªØ­Ù‚ Ù„Ø´Ø±ÙƒØ© Ø¹Ø§ØµÙ…Ø© Ø§Ù„ÙƒÙˆÙ†.\n` +
      `Ø±Ù‚Ù… Ø§Ù„Ø¹Ù‚Ø¯: ${schedule.contracts?.contract_number || '-'}\n` +
      `ØªØ§Ø±ÙŠØ® Ø§Ù„Ø§Ø³ØªØ­Ù‚Ø§Ù‚: ${formatDate(schedule.due_date)}\n` +
      `Ø§Ù„Ù…Ø¨Ù„Øº Ø§Ù„Ù…ØªØ¨Ù‚ÙŠ: ${formatCurrency(remaining)}\n` +
      `Ø´ÙƒØ±Ø§Ù‹ Ù„ÙƒÙ….`
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
          description: `ØªØ­ØµÙŠÙ„ Ø¯ÙØ¹Ø© - Ø¹Ù‚Ø¯ ${selectedSchedule.contracts?.contract_number || ''} - ${selectedSchedule.clients?.name || ''}`,
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
        'ØªØ³Ø¬ÙŠÙ„ ØªØ­ØµÙŠÙ„',
        'collections',
        selectedSchedule.id,
        `ØªØ­ØµÙŠÙ„ Ù…Ø¨Ù„Øº ${formatCurrency(collectedAmount)} Ù…Ù† ${selectedSchedule.clients?.name || 'Ø¹Ù…ÙŠÙ„'} - Ø¹Ù‚Ø¯ ${selectedSchedule.contracts?.contract_number || ''}`,
        selectedSchedule.branch
      );

      await notifyIntegrations({
        title: 'ØªØ­ØµÙŠÙ„ Ø¬Ø¯ÙŠØ¯',
        message: `ØªÙ… ØªØ³Ø¬ÙŠÙ„ ØªØ­ØµÙŠÙ„ Ù…Ù† ${selectedSchedule.clients?.name || 'Ø¹Ù…ÙŠÙ„'} Ù„Ø¹Ù‚Ø¯ ${selectedSchedule.contracts?.contract_number || '-'}`,
        amount: formatCurrency(collectedAmount),
        branch: CITIES[selectedSchedule.branch] || selectedSchedule.branch,
        link: '/collections'
      });

      setShowCollectModal(false);
      setSelectedSchedule(null);
      fetchSchedules();
    } catch (err) {
      console.error('Ø®Ø·Ø£ ÙÙŠ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„ØªØ­ØµÙŠÙ„:', err);
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
          Ø§Ù„ØªØ­ØµÙŠÙ„Ø§Øª
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
            <div className="stat-label">Ù…Ø³ØªØ­Ù‚ Ø§Ù„ÙŠÙˆÙ…</div>
            <div className="stat-value">{formatCurrency(dueToday)}</div>
          </div>
          <div className="stat-icon warning">
            <Calendar size={24} />
          </div>
        </div>

        <div className="stat-card info">
          <div className="stat-info">
            <div className="stat-label">Ù…Ø³ØªØ­Ù‚ Ù‡Ø°Ø§ Ø§Ù„Ø´Ù‡Ø±</div>
            <div className="stat-value">{formatCurrency(dueThisMonth)}</div>
          </div>
          <div className="stat-icon info">
            <DollarSign size={24} />
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-info">
            <div className="stat-label">Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ù…Ø­ØµÙ„</div>
            <div className="stat-value">{formatCurrency(totalCollected)}</div>
          </div>
          <div className="stat-icon success">
            <Check size={24} />
          </div>
        </div>

        <div className="stat-card danger">
          <div className="stat-info">
            <div className="stat-label">Ù…ØªØ£Ø®Ø±</div>
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
            <option value="">Ø§Ù„ÙƒÙ„</option>
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
            <option value="">ÙƒÙ„ Ø§Ù„ÙØ±ÙˆØ¹</option>
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
            placeholder="Ù…Ù† ØªØ§Ø±ÙŠØ®"
          />
        </div>

        <div className="filter-group">
          <input
            type="date"
            className="form-input"
            value={filterDateTo}
            onChange={e => setFilterDateTo(e.target.value)}
            placeholder="Ø¥Ù„Ù‰ ØªØ§Ø±ÙŠØ®"
          />
        </div>

        <div className="filter-group search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="form-input search-input"
            placeholder="Ø¨Ø­Ø« Ø¨Ø§Ù„Ø¹Ù…ÙŠÙ„ Ø£Ùˆ Ø±Ù‚Ù… Ø§Ù„Ø¹Ù‚Ø¯..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="table-container">
        {loading ? (
          <div className="empty-state">
            <p>Ø¬Ø§Ø±ÙŠ Ø§Ù„ØªØ­Ù…ÙŠÙ„...</p>
          </div>
        ) : filteredSchedules.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">ðŸ’°</div>
            <h3>Ù„Ø§ ØªÙˆØ¬Ø¯ ØªØ­ØµÙŠÙ„Ø§Øª</h3>
            <p>Ù„Ù… ÙŠØªÙ… Ø§Ù„Ø¹Ø«ÙˆØ± Ø¹Ù„Ù‰ ØªØ­ØµÙŠÙ„Ø§Øª Ù…Ø·Ø§Ø¨Ù‚Ø© Ù„Ù„Ø¨Ø­Ø«</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Ø§Ù„Ø¹Ù…ÙŠÙ„</th>
                <th>Ø±Ù‚Ù… Ø§Ù„Ø¹Ù‚Ø¯</th>
                <th>ØªØ§Ø±ÙŠØ® Ø§Ù„Ø§Ø³ØªØ­Ù‚Ø§Ù‚</th>
                <th>Ø§Ù„Ù…Ø¨Ù„Øº Ø§Ù„Ù…Ø³ØªØ­Ù‚</th>
                <th>Ø§Ù„Ù…Ø¨Ù„Øº Ø§Ù„Ù…Ø­ØµÙ„</th>
                <th>Ø§Ù„Ø­Ø§Ù„Ø©</th>
                <th>Ø¥Ø¬Ø±Ø§Ø¡Ø§Øª</th>
              </tr>
            </thead>
            <tbody>
              {filteredSchedules.map(schedule => {
                const remaining = (parseFloat(schedule.amount) || 0) - (parseFloat(schedule.collected_amount) || 0);
                return (
                  <tr key={schedule.id}>
                    <td>
                      <strong>{schedule.clients?.name || '-'}</strong>
                    </td>
                    <td>{schedule.contracts?.contract_number || '-'}</td>
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
                            ØªØ³Ø¬ÙŠÙ„ ØªØ­ØµÙŠÙ„
                          </button>
                          <button
                            className="btn btn-whatsapp btn-sm"
                            onClick={() => sendCollectionReminder(schedule)}
                            disabled={!schedule.clients?.phone}
                          >
                            <MessageCircle size={14} />
                            ØªØ°ÙƒÙŠØ±
                          </button>
                        </div>
                      )}
                      {schedule.status === 'collected' && (
                        <span className="badge badge-success">
                          <Check size={12} />
                          ØªÙ… Ø§Ù„ØªØ­ØµÙŠÙ„
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
              <h2 className="modal-title">ØªØ³Ø¬ÙŠÙ„ ØªØ­ØµÙŠÙ„</h2>
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
                        <span className="form-label">Ø§Ù„Ø¹Ù…ÙŠÙ„:</span>
                        <strong> {selectedSchedule.clients?.name || '-'}</strong>
                      </div>
                      <div>
                        <span className="form-label">Ø±Ù‚Ù… Ø§Ù„Ø¹Ù‚Ø¯:</span>
                        <strong> {selectedSchedule.contracts?.contract_number || '-'}</strong>
                      </div>
                    </div>
                    <div className="form-row" style={{ marginTop: '12px' }}>
                      <div>
                        <span className="form-label">Ø§Ù„Ù…Ø¨Ù„Øº Ø§Ù„Ù…Ø³ØªØ­Ù‚:</span>
                        <strong> {formatCurrency(selectedSchedule.amount)}</strong>
                      </div>
                      <div>
                        <span className="form-label">Ø§Ù„Ù…ØªØ¨Ù‚ÙŠ:</span>
                        <strong> {formatCurrency((parseFloat(selectedSchedule.amount) || 0) - (parseFloat(selectedSchedule.collected_amount) || 0))}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Ø§Ù„Ù…Ø¨Ù„Øº Ø§Ù„Ù…Ø­ØµÙ„ *</label>
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
                    <label className="form-label">Ø·Ø±ÙŠÙ‚Ø© Ø§Ù„Ø¯ÙØ¹ *</label>
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
                    <label className="form-label">ØªØ§Ø±ÙŠØ® Ø§Ù„ØªØ­ØµÙŠÙ„ *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={collectForm.collection_date}
                      onChange={e => setCollectForm({ ...collectForm, collection_date: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Ø±Ù‚Ù… Ø§Ù„Ø¥ÙŠØµØ§Ù„</label>
                    <input
                      type="text"
                      className="form-input"
                      value={collectForm.receipt_number}
                      onChange={e => setCollectForm({ ...collectForm, receipt_number: e.target.value })}
                      placeholder="Ø±Ù‚Ù… Ø§Ù„Ø¥ÙŠØµØ§Ù„..."
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Ù…Ù„Ø§Ø­Ø¸Ø§Øª</label>
                  <textarea
                    className="form-textarea"
                    value={collectForm.notes}
                    onChange={e => setCollectForm({ ...collectForm, notes: e.target.value })}
                    placeholder="Ù…Ù„Ø§Ø­Ø¸Ø§Øª Ø¥Ø¶Ø§ÙÙŠØ©..."
                    rows={3}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="submit" className="btn btn-success" disabled={saving}>
                  {saving ? 'Ø¬Ø§Ø±ÙŠ Ø§Ù„Ø­ÙØ¸...' : 'ØªØ³Ø¬ÙŠÙ„ Ø§Ù„ØªØ­ØµÙŠÙ„'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCollectModal(false)}
                >
                  Ø¥Ù„ØºØ§Ø¡
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

