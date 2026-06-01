import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, formatCurrency, formatDate, CITIES, QUOTATION_STATUS, PAYMENT_METHODS } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { User, Phone, Mail, MapPin, Building2, FileText, DollarSign, Plus, ArrowRight, X, Calendar, MessageCircle, Navigation, Printer } from 'lucide-react';
import { openGoogleMaps, openWhatsApp } from '../lib/integrations';

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

  // Stats
  const [totalDue, setTotalDue] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [activeContracts, setActiveContracts] = useState(0);

  // Add site modal
  const [showSiteModal, setShowSiteModal] = useState(false);
  const [savingSite, setSavingSite] = useState(false);
  const [siteForm, setSiteForm] = useState({
    site_name: '',
    address: '',
    city: 'mecca',
    elevator_count: 1,
    elevator_type: '',
    notes: ''
  });

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
      fetchSpareInvoices()
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
        .select('*')
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

  function handleSiteFormChange(field, value) {
    setSiteForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleAddSite(e) {
    e.preventDefault();
    if (!siteForm.site_name) return;

    try {
      setSavingSite(true);
      const { error } = await supabase
        .from('client_sites')
        .insert({
          client_id: id,
          site_name: siteForm.site_name,
          address: siteForm.address || null,
          city: siteForm.city,
          elevator_count: parseInt(siteForm.elevator_count) || 1,
          elevator_type: siteForm.elevator_type || null,
          notes: siteForm.notes || null
        });

      if (error) throw error;

      setSiteForm({ site_name: '', address: '', city: 'mecca', elevator_count: 1, elevator_type: '', notes: '' });
      setShowSiteModal(false);
      fetchSites();
    } catch (err) {
      console.error('خطأ في إضافة الموقع:', err);
      alert('حدث خطأ أثناء إضافة الموقع');
    } finally {
      setSavingSite(false);
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
                <button className="btn btn-primary btn-sm" onClick={() => setShowSiteModal(true)}>
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
                  {sites.map(site => (
                    <div key={site.id} className="card">
                      <div className="card-body">
                        <h4 className="font-bold mb-16">{site.site_name}</h4>
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
                          {site.elevator_type && (
                            <span className="badge badge-warning">
                              {site.elevator_type}
                            </span>
                          )}
                        </div>
                        {site.notes && (
                          <p className="text-muted mt-16">{site.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
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

      {/* Add Site Modal */}
      {showSiteModal && (
        <div className="modal-overlay" onClick={() => setShowSiteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">إضافة موقع جديد</h2>
              <button className="modal-close" onClick={() => setShowSiteModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddSite}>
              <div className="modal-body">
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
                  <Plus size={18} />
                  {savingSite ? 'جاري الحفظ...' : 'إضافة الموقع'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowSiteModal(false)}>
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
