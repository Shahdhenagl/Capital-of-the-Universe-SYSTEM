import { useState, useEffect } from 'react';
import { supabase, formatCurrency, formatDate, CITIES, CONTRACT_STATUS, PAYMENT_METHODS, PAYMENT_FREQUENCIES } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Search, Calendar, DollarSign, Filter, ChevronDown, ChevronUp, X } from 'lucide-react';

function Contracts() {
  const { profile } = useAuth();

  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedContract, setExpandedContract] = useState(null);
  const [scheduleData, setScheduleData] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingContract, setCancellingContract] = useState(null);
  const [saving, setSaving] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchContracts();
  }, []);

  async function fetchContracts() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contracts')
        .select('*, clients(name, phone)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContracts(data || []);
    } catch (err) {
      console.error('خطأ في جلب العقود:', err);
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
      const service = (c.service_type || c.service || '').toLowerCase();
      if (!clientName.includes(term) && !contractNum.includes(term) && !service.includes(term)) return false;
    }
    return true;
  });

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

      setShowCancelModal(false);
      setCancellingContract(null);
      fetchContracts();
    } catch (err) {
      console.error('خطأ في إلغاء العقد:', err);
    } finally {
      setSaving(false);
    }
  }

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
      </div>

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
        {loading ? (
          <div className="empty-state">
            <p>جاري التحميل...</p>
          </div>
        ) : filteredContracts.length === 0 ? (
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
                    <td>{contract.service_type || contract.service || '-'}</td>
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
                      <div className="page-actions">
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
                        {contract.status === 'active' && (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => openCancelModal(contract)}
                            title="إلغاء العقد"
                          >
                            <X size={16} />
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
                              جدول التحصيل
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
                                    const remaining = (parseFloat(item.amount_due) || 0) - (parseFloat(item.collected_amount) || 0);
                                    return (
                                      <tr key={item.id}>
                                        <td>{formatDate(item.due_date)}</td>
                                        <td>{formatCurrency(item.amount_due)}</td>
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

      {/* Cancel Contract Modal */}
      {showCancelModal && cancellingContract && (
        <div className="modal-overlay" onClick={() => setShowCancelModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">إلغاء العقد</h2>
              <button className="modal-close" onClick={() => setShowCancelModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="empty-state">
                <div className="empty-icon">⚠️</div>
                <h3>هل أنت متأكد من إلغاء هذا العقد؟</h3>
                <p>
                  العقد رقم: <strong>{cancellingContract.contract_number}</strong>
                  <br />
                  العميل: <strong>{cancellingContract.clients?.name}</strong>
                  <br />
                  القيمة: <strong>{formatCurrency(cancellingContract.total_amount)}</strong>
                </p>
                <p>هذا الإجراء لا يمكن التراجع عنه</p>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-danger"
                onClick={handleCancelContract}
                disabled={saving}
              >
                {saving ? 'جاري الإلغاء...' : 'تأكيد الإلغاء'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowCancelModal(false)}
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Contracts;
