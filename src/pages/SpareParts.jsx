import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, formatCurrency, formatDateShort, CITIES, PAYMENT_METHODS, logActivity } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Package, Plus, FileText, Search, Edit, Trash2, AlertTriangle, X, Eye, Download, Printer } from 'lucide-react';

function SpareParts({ cityFilter = 'all' }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [parts, setParts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceBranchFilter, setInvoiceBranchFilter] = useState('');
  const [invoicePaymentFilter, setInvoicePaymentFilter] = useState('');
  const [invoiceDateFrom, setInvoiceDateFrom] = useState('');
  const [invoiceDateTo, setInvoiceDateTo] = useState('');
  const [printReportActive, setPrintReportActive] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    part_number: '',
    buy_price: '',
    sell_price: '',
    quantity: '',
    min_quantity: '',
    category: '',
    branch: 'mecca',
    notes: ''
  });

  useEffect(() => {
    fetchParts();
    fetchInvoices();
  }, []);

  useEffect(() => {
    setBranchFilter(cityFilter === 'all' ? '' : cityFilter);
    setInvoiceBranchFilter(cityFilter === 'all' ? '' : cityFilter);
  }, [cityFilter]);

  async function fetchParts() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('spare_parts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setParts(data || []);
    } catch (err) {
      console.error('Error fetching spare parts:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchInvoices() {
    try {
      const { data, error } = await supabase
        .from('spare_parts_invoices')
        .select('*, clients(name, phone)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (err) {
      console.error('Error fetching spare parts invoices:', err);
    }
  }

  const filteredParts = parts.filter(part => {
    const matchesSearch = !searchTerm ||
      part.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      part.part_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBranch = !branchFilter || part.branch === branchFilter;
    const matchesStock = !stockFilter ||
      (stockFilter === 'low' && part.quantity <= (part.min_quantity || 0)) ||
      (stockFilter === 'available' && part.quantity > (part.min_quantity || 0)) ||
      (stockFilter === 'out' && part.quantity <= 0);
    return matchesSearch && matchesBranch && matchesStock;
  });

  const filteredInvoices = invoices.filter(invoice => {
    const query = invoiceSearch.toLowerCase();
    const invoiceDate = invoice.created_at ? new Date(invoice.created_at) : null;
    const fromDate = invoiceDateFrom ? new Date(`${invoiceDateFrom}T00:00:00`) : null;
    const toDate = invoiceDateTo ? new Date(`${invoiceDateTo}T23:59:59`) : null;
    const matchesSearch = !query ||
      invoice.invoice_number?.toLowerCase().includes(query) ||
      invoice.clients?.name?.toLowerCase().includes(query) ||
      invoice.clients?.phone?.toLowerCase().includes(query) ||
      invoice.notes?.toLowerCase().includes(query);
    const matchesBranch = !invoiceBranchFilter || invoice.branch === invoiceBranchFilter;
    const matchesPayment = !invoicePaymentFilter || invoice.payment_method === invoicePaymentFilter;
    const matchesFrom = !fromDate || (invoiceDate && invoiceDate >= fromDate);
    const matchesTo = !toDate || (invoiceDate && invoiceDate <= toDate);
    return matchesSearch && matchesBranch && matchesPayment && matchesFrom && matchesTo;
  });

  const totalParts = parts.length;
  const inventoryValue = parts.reduce((sum, p) => sum + (p.buy_price || 0) * (p.quantity || 0), 0);
  const expectedProfit = parts.reduce((sum, p) => sum + ((p.sell_price || 0) - (p.buy_price || 0)) * (p.quantity || 0), 0);
  const lowStockCount = parts.filter(p => p.quantity <= (p.min_quantity || 0)).length;
  const invoiceSalesTotal = filteredInvoices.reduce((sum, invoice) => sum + (Number(invoice.total_amount) || 0), 0);
  const invoiceCostTotal = filteredInvoices.reduce((sum, invoice) => sum + (Number(invoice.total_cost) || 0), 0);
  const invoiceProfitTotal = filteredInvoices.reduce((sum, invoice) => sum + (Number(invoice.total_profit) || 0), 0);

  function getMargin(part) {
    if (!part.buy_price || part.buy_price === 0) return '0%';
    return ((part.sell_price - part.buy_price) / part.buy_price * 100).toFixed(1) + '%';
  }

  function exportInvoicesCsv() {
    const headers = ['رقم الفاتورة', 'العميل', 'الجوال', 'الفرع', 'طريقة الدفع', 'إجمالي البيع', 'التكلفة', 'الربح', 'التاريخ', 'ملاحظات'];
    const rows = filteredInvoices.map(invoice => [
      invoice.invoice_number || '',
      invoice.clients?.name || '',
      invoice.clients?.phone || '',
      CITIES[invoice.branch] || invoice.branch || '',
      PAYMENT_METHODS[invoice.payment_method] || invoice.payment_method || '',
      invoice.total_amount || 0,
      invoice.total_cost || 0,
      invoice.total_profit || 0,
      formatDateShort(invoice.created_at),
      invoice.notes || ''
    ]);
    const escapeCell = (value) => `"${String(value).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map(row => row.map(escapeCell).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `spare-parts-invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function printInvoicesReport() {
    setPrintReportActive(true);
    setTimeout(() => {
      window.print();
      setPrintReportActive(false);
    }, 100);
  }

  function openAddModal() {
    setEditingPart(null);
    setFormData({
      name: '',
      part_number: '',
      buy_price: '',
      sell_price: '',
      quantity: '',
      min_quantity: '',
      category: '',
      branch: 'mecca',
      notes: ''
    });
    setShowModal(true);
  }

  function openEditModal(part) {
    setEditingPart(part);
    setFormData({
      name: part.name || '',
      part_number: part.part_number || '',
      buy_price: part.buy_price || '',
      sell_price: part.sell_price || '',
      quantity: part.quantity || '',
      min_quantity: part.min_quantity || '',
      category: part.category || '',
      branch: part.branch || 'mecca',
      notes: part.notes || ''
    });
    setShowModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const record = {
        name: formData.name,
        part_number: formData.part_number,
        buy_price: parseFloat(formData.buy_price) || 0,
        sell_price: parseFloat(formData.sell_price) || 0,
        quantity: parseInt(formData.quantity) || 0,
        min_quantity: parseInt(formData.min_quantity) || 0,
        category: formData.category,
        branch: formData.branch,
        notes: formData.notes
      };

      if (editingPart) {
        const { error } = await supabase
          .from('spare_parts')
          .update(record)
          .eq('id', editingPart.id);
        if (error) throw error;
        await logActivity(profile?.id, profile?.full_name, 'تعديل', 'قطع الغيار', editingPart.id, `تم تعديل القطعة: ${formData.name}`, formData.branch);
      } else {
        const { error } = await supabase
          .from('spare_parts')
          .insert(record);
        if (error) throw error;
        await logActivity(profile?.id, profile?.full_name, 'إضافة', 'قطع الغيار', null, `تم إضافة قطعة جديدة: ${formData.name}`, formData.branch);
      }

      setShowModal(false);
      fetchParts();
    } catch (err) {
      console.error('Error saving spare part:', err);
      alert('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(part) {
    if (!window.confirm(`هل أنت متأكد من حذف "${part.name}"؟`)) return;
    try {
      const { error } = await supabase
        .from('spare_parts')
        .delete()
        .eq('id', part.id);
      if (error) throw error;
      await logActivity(profile?.id, profile?.full_name, 'حذف', 'قطع الغيار', part.id, `تم حذف القطعة: ${part.name}`, part.branch);
      fetchParts();
    } catch (err) {
      console.error('Error deleting spare part:', err);
      alert('حدث خطأ أثناء الحذف');
    }
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
      <div className="page-header">
        <h1 className="page-title">
          <span className="title-icon" style={{ background: 'var(--primary-bg)', color: 'var(--primary-light)' }}>
            <Package size={28} />
          </span>
          قطع الغيار
        </h1>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => navigate('/spare-parts/invoice')}>
            <FileText size={18} />
            فاتورة بيع
          </button>
          <button className="btn btn-primary" onClick={openAddModal}>
            <Plus size={18} />
            إضافة قطعة
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-info">
            <div className="stat-label">إجمالي القطع</div>
            <div className="stat-value">{totalParts}</div>
          </div>
          <div className="stat-icon primary">
            <Package size={28} />
          </div>
        </div>
        <div className="stat-card success">
          <div className="stat-info">
            <div className="stat-label">قيمة المخزون</div>
            <div className="stat-value">{formatCurrency(inventoryValue)}</div>
          </div>
          <div className="stat-icon success">
            <Package size={28} />
          </div>
        </div>
        <div className="stat-card info">
          <div className="stat-info">
            <div className="stat-label">هامش الربح المتوقع</div>
            <div className="stat-value">{formatCurrency(expectedProfit)}</div>
          </div>
          <div className="stat-icon info">
            <FileText size={28} />
          </div>
        </div>
        <div className="stat-card danger">
          <div className="stat-info">
            <div className="stat-label">قطع منخفضة المخزون</div>
            <div className="stat-value">{lowStockCount}</div>
          </div>
          <div className="stat-icon danger">
            <AlertTriangle size={28} />
          </div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="بحث بالاسم أو رقم القطعة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <select
            className="form-select"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
          >
            <option value="">كل الفروع</option>
            {Object.entries(CITIES).map(([key, val]) => (
              <option key={key} value={key}>{val}</option>
            ))}
          </select>
          <select
            className="form-select"
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
          >
            <option value="">كل حالات المخزون</option>
            <option value="low">قرب ينفذ</option>
            <option value="out">نفد المخزون</option>
            <option value="available">متوفر</option>
          </select>
        </div>
      </div>

      <div className="table-container">
        {filteredParts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <h3>لا توجد قطع غيار</h3>
            <p>قم بإضافة قطع غيار جديدة لتظهر هنا</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>اسم القطعة</th>
                <th>رقم القطعة</th>
                <th>سعر الشراء</th>
                <th>سعر البيع</th>
                <th>هامش الربح</th>
                <th>الكمية</th>
                <th>الفرع</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredParts.map(part => (
                <tr key={part.id}>
                  <td>
                    <span className="font-semibold">{part.name}</span>
                  </td>
                  <td>{part.part_number || '—'}</td>
                  <td>{formatCurrency(part.buy_price)}</td>
                  <td>{formatCurrency(part.sell_price)}</td>
                  <td>
                    <span className="text-success font-semibold">{getMargin(part)}</span>
                  </td>
                  <td>
                    <span className={part.quantity <= (part.min_quantity || 0) ? 'text-danger font-bold' : ''}>
                      {part.quantity}
                      {part.quantity <= (part.min_quantity || 0) && (
                        <AlertTriangle size={14} className="text-danger" />
                      )}
                    </span>
                  </td>
                  <td>{CITIES[part.branch] || part.branch}</td>
                  <td>
                    <div className="flex gap-8">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(part)}>
                        <Edit size={16} />
                      </button>
                      <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(part)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card mt-24">
        <div className="card-header">
          <div>
            <h2 className="card-title">فواتير بيع قطع الغيار</h2>
            <p className="text-muted">بحث، فلترة، تصدير ومراجعة كل فواتير بيع القطع</p>
          </div>
          <div className="flex gap-8">
            <button className="btn btn-secondary" onClick={exportInvoicesCsv} disabled={filteredInvoices.length === 0}>
              <Download size={18} />
              تصدير CSV
            </button>
            <button className="btn btn-secondary" onClick={printInvoicesReport} disabled={filteredInvoices.length === 0}>
              <Printer size={18} />
              طباعة التقرير
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/spare-parts/invoice')}>
              <Plus size={18} />
              فاتورة جديدة
            </button>
          </div>
        </div>

        <div className="stats-grid mt-16">
          <div className="stat-card primary">
            <div className="stat-info">
              <div className="stat-label">عدد الفواتير</div>
              <div className="stat-value">{filteredInvoices.length}</div>
            </div>
            <div className="stat-icon primary">
              <FileText size={26} />
            </div>
          </div>
          <div className="stat-card success">
            <div className="stat-info">
              <div className="stat-label">إجمالي المبيعات</div>
              <div className="stat-value">{formatCurrency(invoiceSalesTotal)}</div>
            </div>
            <div className="stat-icon success">
              <FileText size={26} />
            </div>
          </div>
          <div className="stat-card warning">
            <div className="stat-info">
              <div className="stat-label">إجمالي التكلفة</div>
              <div className="stat-value">{formatCurrency(invoiceCostTotal)}</div>
            </div>
            <div className="stat-icon warning">
              <Package size={26} />
            </div>
          </div>
          <div className="stat-card info">
            <div className="stat-info">
              <div className="stat-label">صافي الربح</div>
              <div className="stat-value">{formatCurrency(invoiceProfitTotal)}</div>
            </div>
            <div className="stat-icon info">
              <FileText size={26} />
            </div>
          </div>
        </div>

        <div className="filter-bar mt-16">
          <div className="search-wrapper">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="بحث برقم الفاتورة أو العميل أو الجوال..."
              value={invoiceSearch}
              onChange={(e) => setInvoiceSearch(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <select
              className="form-select"
              value={invoiceBranchFilter}
              onChange={(e) => setInvoiceBranchFilter(e.target.value)}
            >
              <option value="">كل الفروع</option>
              {Object.entries(CITIES).map(([key, val]) => (
                <option key={key} value={key}>{val}</option>
              ))}
            </select>
            <select
              className="form-select"
              value={invoicePaymentFilter}
              onChange={(e) => setInvoicePaymentFilter(e.target.value)}
            >
              <option value="">كل طرق الدفع</option>
              {Object.entries(PAYMENT_METHODS).map(([key, val]) => (
                <option key={key} value={key}>{val}</option>
              ))}
            </select>
            <input
              type="date"
              className="form-input"
              value={invoiceDateFrom}
              onChange={(e) => setInvoiceDateFrom(e.target.value)}
            />
            <input
              type="date"
              className="form-input"
              value={invoiceDateTo}
              onChange={(e) => setInvoiceDateTo(e.target.value)}
            />
          </div>
        </div>

        <div className="table-container">
          {filteredInvoices.length === 0 ? (
            <div className="empty-state">
              <FileText size={48} className="text-muted" />
              <h3>لا توجد فواتير بيع قطع</h3>
              <p>أنشئي فاتورة بيع جديدة أو غيّري الفلاتر الحالية</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>رقم الفاتورة</th>
                  <th>العميل</th>
                  <th>الجوال</th>
                  <th>الفرع</th>
                  <th>طريقة الدفع</th>
                  <th>إجمالي البيع</th>
                  <th>التكلفة</th>
                  <th>الربح</th>
                  <th>التاريخ</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map(invoice => (
                  <tr key={invoice.id}>
                    <td className="font-semibold">{invoice.invoice_number || invoice.id?.slice(0, 8)}</td>
                    <td>{invoice.clients?.name || 'عميل غير محدد'}</td>
                    <td>{invoice.clients?.phone || '—'}</td>
                    <td>{CITIES[invoice.branch] || invoice.branch || '—'}</td>
                    <td>{PAYMENT_METHODS[invoice.payment_method] || invoice.payment_method || '—'}</td>
                    <td>{formatCurrency(invoice.total_amount)}</td>
                    <td>{formatCurrency(invoice.total_cost)}</td>
                    <td>
                      <span className={(invoice.total_profit || 0) >= 0 ? 'text-success font-semibold' : 'text-danger font-semibold'}>
                        {formatCurrency(invoice.total_profit)}
                      </span>
                    </td>
                    <td>{formatDateShort(invoice.created_at)}</td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => navigate(`/spare-parts/invoices/${invoice.id}`)}
                        title="عرض وطباعة الفاتورة"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingPart ? 'تعديل قطعة غيار' : 'إضافة قطعة غيار جديدة'}
              </h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">اسم القطعة *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">رقم القطعة</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.part_number}
                      onChange={(e) => setFormData({ ...formData, part_number: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">سعر الشراء *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.buy_price}
                      onChange={(e) => setFormData({ ...formData, buy_price: e.target.value })}
                      required
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">سعر البيع *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.sell_price}
                      onChange={(e) => setFormData({ ...formData, sell_price: e.target.value })}
                      required
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">الكمية *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      required
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">الحد الأدنى للمخزون</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.min_quantity}
                      onChange={(e) => setFormData({ ...formData, min_quantity: e.target.value })}
                      min="0"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">الفئة</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="مثال: محركات، كابلات، أبواب..."
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">الفرع *</label>
                    <select
                      className="form-select"
                      value={formData.branch}
                      onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                      required
                    >
                      {Object.entries(CITIES).map(([key, val]) => (
                        <option key={key} value={key}>{val}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">ملاحظات</label>
                  <textarea
                    className="form-textarea"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'جاري الحفظ...' : (editingPart ? 'تحديث' : 'إضافة')}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {printReportActive && (
        <div className="print-only-container">
          <div className="print-header">
            <div className="print-logo-section">
              <h1>تقرير فواتير بيع قطع الغيار</h1>
            </div>
          </div>
          <div className="print-title">كشف فواتير بيع قطع الغيار</div>
          <div className="print-meta-grid">
            <div className="print-meta-item">
              <span>عدد الفواتير</span>
              <strong>{filteredInvoices.length}</strong>
            </div>
            <div className="print-meta-item">
              <span>إجمالي المبيعات</span>
              <strong>{formatCurrency(invoiceSalesTotal)}</strong>
            </div>
            <div className="print-meta-item">
              <span>إجمالي التكلفة</span>
              <strong>{formatCurrency(invoiceCostTotal)}</strong>
            </div>
            <div className="print-meta-item">
              <span>صافي الربح</span>
              <strong>{formatCurrency(invoiceProfitTotal)}</strong>
            </div>
          </div>
          <table className="print-table">
            <thead>
              <tr>
                <th>رقم الفاتورة</th>
                <th>العميل</th>
                <th>الفرع</th>
                <th>طريقة الدفع</th>
                <th>إجمالي البيع</th>
                <th>الربح</th>
                <th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map(invoice => (
                <tr key={invoice.id}>
                  <td>{invoice.invoice_number || invoice.id?.slice(0, 8)}</td>
                  <td>{invoice.clients?.name || '-'}</td>
                  <td>{CITIES[invoice.branch] || invoice.branch || '-'}</td>
                  <td>{PAYMENT_METHODS[invoice.payment_method] || invoice.payment_method || '-'}</td>
                  <td>{formatCurrency(invoice.total_amount)}</td>
                  <td>{formatCurrency(invoice.total_profit)}</td>
                  <td>{formatDateShort(invoice.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default SpareParts;
