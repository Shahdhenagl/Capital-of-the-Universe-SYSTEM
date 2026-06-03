import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, formatCurrency, formatDateShort, CITIES, PAYMENT_METHODS, logActivity } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import PrintHeader from '../components/PrintHeader';
import PrintFooter from '../components/PrintFooter';
import { Package, Plus, FileText, Search, Edit, Trash2, AlertTriangle, X, Eye, Download, Printer, Users, BarChart3, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { checkLowStockParts } from '../lib/integrations';

function SpareParts({ cityFilter = 'all' }) {
  const { profile } = useAuth();
  const navigate = useNavigate();

  // Tabs state
  const [activeTab, setActiveTab] = useState('parts'); // 'parts' | 'suppliers' | 'purchases' | 'sales' | 'analytics'

  // Data states
  const [parts, setParts] = useState([]);
  const [invoices, setInvoices] = useState([]); // Sales invoices
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]); // Purchase invoices
  const [salesItems, setSalesItems] = useState([]); // All sold items for analytics
  const [purchaseItems, setPurchaseItems] = useState([]); // All purchased items for pricing stats
  const [loading, setLoading] = useState(true);

  // Filters for parts
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');

  // Filters for sales invoices
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceBranchFilter, setInvoiceBranchFilter] = useState('');
  const [invoicePaymentFilter, setInvoicePaymentFilter] = useState('');
  const [invoiceDateFrom, setInvoiceDateFrom] = useState('');
  const [invoiceDateTo, setInvoiceDateTo] = useState('');

  // Filters for suppliers
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierCityFilter, setSupplierCityFilter] = useState('');

  // Filters for purchases
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [purchaseBranchFilter, setPurchaseBranchFilter] = useState('');
  const [purchasePaymentFilter, setPurchasePaymentFilter] = useState('');

  // Print state
  const [printReportActive, setPrintReportActive] = useState(false);
  const [printReportType, setPrintReportType] = useState('sales'); // 'sales' | 'purchases' | 'parts'

  // Modals state
  const [showPartModal, setShowPartModal] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [partSaving, setPartSaving] = useState(false);
  const [partFormData, setPartFormData] = useState({
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

  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [supplierSaving, setSupplierSaving] = useState(false);
  const [supplierFormData, setSupplierFormData] = useState({
    name: '',
    company_name: '',
    phone: '',
    email: '',
    city: 'mecca',
    address: '',
    notes: ''
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    setBranchFilter(cityFilter === 'all' ? '' : cityFilter);
    setInvoiceBranchFilter(cityFilter === 'all' ? '' : cityFilter);
    setSupplierCityFilter(cityFilter === 'all' ? '' : cityFilter);
    setPurchaseBranchFilter(cityFilter === 'all' ? '' : cityFilter);
  }, [cityFilter]);

  async function fetchAllData() {
    try {
      setLoading(true);
      await Promise.all([
        fetchParts(),
        fetchInvoices(),
        fetchSuppliers(),
        fetchPurchases(),
        fetchSalesItems(),
        fetchPurchaseItems()
      ]);
    } catch (err) {
      console.error('Error fetching all spare parts modules data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchParts() {
    const { data, error } = await supabase
      .from('spare_parts')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    setParts(data || []);
  }

  async function fetchInvoices() {
    const { data, error } = await supabase
      .from('spare_parts_invoices')
      .select('*, clients(name, phone)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    setInvoices(data || []);
  }

  async function fetchSuppliers() {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('created_at', { ascending: false });
    if (error && error.code !== 'PGRST116') throw error;
    setSuppliers(data || []);
  }

  async function fetchPurchases() {
    const { data, error } = await supabase
      .from('spare_parts_purchases')
      .select('*, suppliers(name, phone)')
      .order('created_at', { ascending: false });
    if (error && error.code !== 'PGRST116') throw error;
    setPurchases(data || []);
  }

  async function fetchSalesItems() {
    const { data, error } = await supabase
      .from('spare_parts_invoice_items')
      .select('*, spare_parts(name, part_number)');
    if (error && error.code !== 'PGRST116') throw error;
    setSalesItems(data || []);
  }

  async function fetchPurchaseItems() {
    const { data, error } = await supabase
      .from('spare_parts_purchase_items')
      .select('*, spare_parts_purchases(created_at)');
    if (error && error.code !== 'PGRST116') throw error;
    setPurchaseItems(data || []);
  }

  // --- Filtering ---
  const filteredParts = parts.filter(part => {
    const matchesSearch = !searchTerm ||
      (part.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (part.part_number || '').toLowerCase().includes(searchTerm.toLowerCase());
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
      (invoice.invoice_number || '').toLowerCase().includes(query) ||
      (invoice.clients?.name || '').toLowerCase().includes(query) ||
      (invoice.clients?.phone || '').toLowerCase().includes(query) ||
      (invoice.notes || '').toLowerCase().includes(query);
    const matchesBranch = !invoiceBranchFilter || invoice.branch === invoiceBranchFilter;
    const matchesPayment = !invoicePaymentFilter || invoice.payment_method === invoicePaymentFilter;
    const matchesFrom = !fromDate || (invoiceDate && invoiceDate >= fromDate);
    const matchesTo = !toDate || (invoiceDate && invoiceDate <= toDate);
    return matchesSearch && matchesBranch && matchesPayment && matchesFrom && matchesTo;
  });

  const filteredSuppliers = suppliers.filter(sup => {
    const query = supplierSearch.toLowerCase();
    const matchesSearch = !query ||
      (sup.name || '').toLowerCase().includes(query) ||
      (sup.company_name || '').toLowerCase().includes(query) ||
      (sup.phone || '').toLowerCase().includes(query) ||
      (sup.notes || '').toLowerCase().includes(query);
    const matchesCity = !supplierCityFilter || sup.city === supplierCityFilter;
    return matchesSearch && matchesCity;
  });

  const filteredPurchases = purchases.filter(p => {
    const query = purchaseSearch.toLowerCase();
    const matchesSearch = !query ||
      (p.purchase_number || '').toLowerCase().includes(query) ||
      (p.suppliers?.name || '').toLowerCase().includes(query) ||
      (p.suppliers?.phone || '').toLowerCase().includes(query) ||
      (p.notes || '').toLowerCase().includes(query);
    const matchesBranch = !purchaseBranchFilter || p.branch === purchaseBranchFilter;
    const matchesPayment = !purchasePaymentFilter || p.payment_method === purchasePaymentFilter;
    return matchesSearch && matchesBranch && matchesPayment;
  });

  // --- Calculations ---
  const totalPartsCount = parts.length;
  const inventoryValue = parts.reduce((sum, p) => sum + (p.buy_price || 0) * (p.quantity || 0), 0);
  const expectedProfit = parts.reduce((sum, p) => sum + ((p.sell_price || 0) - (p.buy_price || 0)) * (p.quantity || 0), 0);
  const lowStockCount = parts.filter(p => p.quantity <= (p.min_quantity || 0)).length;

  const invoiceSalesTotal = filteredInvoices.reduce((sum, invoice) => sum + (Number(invoice.total_amount) || 0), 0);
  const invoiceCostTotal = filteredInvoices.reduce((sum, invoice) => sum + (Number(invoice.total_cost) || 0), 0);
  const invoiceProfitTotal = filteredInvoices.reduce((sum, invoice) => sum + (Number(invoice.total_profit) || 0), 0);

  const totalPurchasesAmount = filteredPurchases.reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0);

  function getMargin(part) {
    if (!part.buy_price || part.buy_price === 0) return '0%';
    return ((part.sell_price - part.buy_price) / part.buy_price * 100).toFixed(1) + '%';
  }

  function getPartPurchaseStats(partId, defaultBuyPrice) {
    const partPurchases = purchaseItems.filter(item => item.spare_part_id === partId);
    
    // Last Purchase Price
    let lastPrice = defaultBuyPrice;
    if (partPurchases.length > 0) {
      const sorted = [...partPurchases].sort((a, b) => {
        const dateA = new Date(a.spare_parts_purchases?.created_at || 0);
        const dateB = new Date(b.spare_parts_purchases?.created_at || 0);
        return dateB - dateA;
      });
      lastPrice = sorted[0].unit_buy_price;
    }
    
    // Average Purchase Price
    let averagePrice = defaultBuyPrice;
    if (partPurchases.length > 0) {
      const totalQty = partPurchases.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const totalCost = partPurchases.reduce((sum, item) => sum + (item.quantity || 0) * (item.unit_buy_price || 0), 0);
      if (totalQty > 0) {
        averagePrice = totalCost / totalQty;
      }
    }
    
    return { lastPrice, averagePrice };
  }

  // --- CSV Export ---
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

  // --- Reports Print ---
  function printReport(type) {
    setPrintReportType(type);
    setPrintReportActive(true);
    setTimeout(() => {
      window.print();
      setPrintReportActive(false);
    }, 120);
  }

  // --- Parts CRUD ---
  function openAddPartModal() {
    setEditingPart(null);
    setPartFormData({
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
    setShowPartModal(true);
  }

  function openEditPartModal(part) {
    setEditingPart(part);
    setPartFormData({
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
    setShowPartModal(true);
  }

  async function handleSavePart(e) {
    e.preventDefault();
    setPartSaving(true);
    try {
      const record = {
        name: partFormData.name,
        part_number: partFormData.part_number,
        buy_price: parseFloat(partFormData.buy_price) || 0,
        sell_price: parseFloat(partFormData.sell_price) || 0,
        quantity: parseInt(partFormData.quantity) || 0,
        min_quantity: parseInt(partFormData.min_quantity) || 0,
        category: partFormData.category,
        branch: partFormData.branch,
        notes: partFormData.notes
      };

      if (editingPart) {
        const { error } = await supabase
          .from('spare_parts')
          .update(record)
          .eq('id', editingPart.id);
        if (error) throw error;
        await logActivity(profile?.id, profile?.full_name, 'تعديل', 'قطع الغيار', editingPart.id, `تم تعديل القطعة: ${partFormData.name}`, partFormData.branch);
      } else {
        const { error } = await supabase
          .from('spare_parts')
          .insert(record);
        if (error) throw error;
        await logActivity(profile?.id, profile?.full_name, 'إضافة', 'قطع الغيار', null, `تم إضافة قطعة جديدة: ${partFormData.name}`, partFormData.branch);
      }

      setShowPartModal(false);
      fetchParts();
      
      // Check for low stock immediately
      try {
        await checkLowStockParts(profile?.id, profile?.full_name, partFormData.branch);
      } catch (err) {
        console.error('Error running low stock check after part save:', err);
      }
    } catch (err) {
      console.error('Error saving spare part:', err);
      alert('حدث خطأ أثناء حفظ القطعة');
    } finally {
      setPartSaving(false);
    }
  }

  async function handleDeletePart(part) {
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

  // --- Suppliers CRUD ---
  function openAddSupplierModal() {
    setEditingSupplier(null);
    setSupplierFormData({
      name: '',
      company_name: '',
      phone: '',
      email: '',
      city: 'mecca',
      address: '',
      notes: ''
    });
    setShowSupplierModal(true);
  }

  function openEditSupplierModal(sup) {
    setEditingSupplier(sup);
    setSupplierFormData({
      name: sup.name || '',
      company_name: sup.company_name || '',
      phone: sup.phone || '',
      email: sup.email || '',
      city: sup.city || 'mecca',
      address: sup.address || '',
      notes: sup.notes || ''
    });
    setShowSupplierModal(true);
  }

  async function handleSaveSupplier(e) {
    e.preventDefault();
    setSupplierSaving(true);
    try {
      const record = {
        name: supplierFormData.name,
        company_name: supplierFormData.company_name,
        phone: supplierFormData.phone,
        email: supplierFormData.email,
        city: supplierFormData.city,
        address: supplierFormData.address,
        notes: supplierFormData.notes
      };

      if (editingSupplier) {
        const { error } = await supabase
          .from('suppliers')
          .update(record)
          .eq('id', editingSupplier.id);
        if (error) throw error;
        await logActivity(profile?.id, profile?.full_name, 'تعديل مورد', 'قطع الغيار', editingSupplier.id, `تم تعديل المورد: ${supplierFormData.name}`, supplierFormData.city);
      } else {
        const { error } = await supabase
          .from('suppliers')
          .insert(record);
        if (error) throw error;
        await logActivity(profile?.id, profile?.full_name, 'إضافة مورد', 'قطع الغيار', null, `تم إضافة المورد: ${supplierFormData.name}`, supplierFormData.city);
      }

      setShowSupplierModal(false);
      fetchSuppliers();
    } catch (err) {
      console.error('Error saving supplier:', err);
      alert('حدث خطأ أثناء حفظ بيانات المورد');
    } finally {
      setSupplierSaving(false);
    }
  }

  async function handleDeleteSupplier(sup) {
    if (!window.confirm(`هل أنت متأكد من حذف المورد "${sup.name}"؟`)) return;
    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', sup.id);
      if (error) throw error;
      await logActivity(profile?.id, profile?.full_name, 'حذف مورد', 'قطع الغيار', sup.id, `تم حذف المورد: ${sup.name}`, sup.city);
      fetchSuppliers();
    } catch (err) {
      console.error('Error deleting supplier:', err);
      alert('تعذر حذف المورد، قد يكون مرتبطاً بفواتير شراء مبرمة.');
    }
  }

  // --- Analytics Calculations ---
  const analyticsData = useMemo(() => {
    // 1. Group sold items by spare_part_id
    const salesGroup = {};
    salesItems.forEach(item => {
      const partId = item.spare_part_id;
      const qty = Number(item.quantity) || 0;
      if (!salesGroup[partId]) {
        salesGroup[partId] = {
          id: partId,
          name: item.spare_parts?.name || 'قطعة غير معروفة',
          part_number: item.spare_parts?.part_number || '',
          qtySold: 0,
          revenue: 0,
          profit: 0
        };
      }
      salesGroup[partId].qtySold += qty;
      salesGroup[partId].revenue += (Number(item.total_price) || 0);
      salesGroup[partId].profit += (Number(item.profit) || 0);
    });

    // Convert to array
    const salesArr = Object.values(salesGroup);

    // 2. Most Sold Parts (الأكثر مبيعاً)
    const mostSold = [...salesArr].sort((a, b) => b.qtySold - a.qtySold).slice(0, 5);

    // 3. Least Sold / Dead Stock (الأقل مبيعاً أو الراكدة)
    // Map all parts to their sales, including parts with 0 sales
    const allPartsSales = parts.map(part => {
      const sale = salesGroup[part.id] || { qtySold: 0, revenue: 0, profit: 0 };
      return {
        id: part.id,
        name: part.name,
        part_number: part.part_number,
        qtySold: sale.qtySold,
        revenue: sale.revenue,
        quantityInStock: part.quantity || 0
      };
    });

    const leastSold = [...allPartsSales].sort((a, b) => a.qtySold - b.qtySold).slice(0, 5);

    return {
      mostSold,
      leastSold
    };
  }, [parts, salesItems]);

  if (loading) {
    return (
      <div className="loading-inline">
        <div className="loader"></div>
      </div>
    );
  }

  return (
    <div dir="rtl">
      {/* Page Header */}
      <div className="page-header invoice-no-print">
        <h1 className="page-title">
          <span className="title-icon" style={{ background: 'var(--primary-bg)', color: 'var(--primary-light)' }}>
            <Package size={28} />
          </span>
          إدارة مستودع قطع الغيار والمشتريات
        </h1>
        <div className="page-actions">
          {activeTab === 'parts' && (
            <button className="btn btn-primary" onClick={openAddPartModal}>
              <Plus size={18} />
              إضافة قطعة جديدة
            </button>
          )}
          {activeTab === 'suppliers' && (
            <button className="btn btn-primary" onClick={openAddSupplierModal}>
              <Plus size={18} />
              إضافة مورد جديد
            </button>
          )}
          {activeTab === 'purchases' && (
            <button className="btn btn-success" onClick={() => navigate('/spare-parts/purchase-invoice')}>
              <Plus size={18} />
              فاتورة شراء جديدة
            </button>
          )}
          {activeTab === 'sales' && (
            <button className="btn btn-success" onClick={() => navigate('/spare-parts/invoice')}>
              <Plus size={18} />
              فاتورة بيع جديدة
            </button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="tabs-container mb-24 invoice-no-print" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', flexWrap: 'wrap' }}>
        <button
          className={`btn ${activeTab === 'parts' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('parts')}
        >
          <Package size={16} />
          المخزون والقطع
        </button>
        <button
          className={`btn ${activeTab === 'suppliers' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('suppliers')}
        >
          <Users size={16} />
          الموردين
        </button>
        <button
          className={`btn ${activeTab === 'purchases' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('purchases')}
        >
          <TrendingDown size={16} />
          فواتير الشراء (الموردين)
        </button>
        <button
          className={`btn ${activeTab === 'sales' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('sales')}
        >
          <TrendingUp size={16} />
          فواتير البيع (العملاء)
        </button>
        <button
          className={`btn ${activeTab === 'analytics' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('analytics')}
        >
          <BarChart3 size={16} />
          تحليلات المبيعات والمخزون
        </button>
      </div>

      {/* Tab 1: Parts Inventory */}
      {activeTab === 'parts' && (
        <div className="invoice-no-print">
          <div className="stats-grid mb-24">
            <div className="stat-card primary">
              <div className="stat-info">
                <div className="stat-label">إجمالي أصناف المخزون</div>
                <div className="stat-value">{totalPartsCount} صنف</div>
              </div>
              <div className="stat-icon primary">
                <Package size={28} />
              </div>
            </div>
            <div className="stat-card success">
              <div className="stat-info">
                <div className="stat-label">القيمة الكلية للمخزون (تكلفة)</div>
                <div className="stat-value">{formatCurrency(inventoryValue)}</div>
              </div>
              <div className="stat-icon success">
                <DollarSign size={28} />
              </div>
            </div>
            <div className="stat-card info">
              <div className="stat-info">
                <div className="stat-label">الأرباح المتوقعة عند البيع بالكامل</div>
                <div className="stat-value">{formatCurrency(expectedProfit)}</div>
              </div>
              <div className="stat-icon info">
                <FileText size={28} />
              </div>
            </div>
            <div className="stat-card danger">
              <div className="stat-info">
                <div className="stat-label">قطع منخفضة المخزون / شارفت للنفاد</div>
                <div className="stat-value">{lowStockCount}</div>
              </div>
              <div className="stat-icon danger">
                <AlertTriangle size={28} />
              </div>
            </div>
          </div>

          <div className="filter-bar mb-16">
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
              <button className="btn btn-secondary" onClick={() => printReport('parts')} disabled={filteredParts.length === 0}>
                <Printer size={18} />
                طباعة جرد المخزن
              </button>
            </div>
          </div>

          <div className="table-container">
            {filteredParts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📦</div>
                <h3>لا توجد قطع غيار مطابقة للبحث</h3>
                <p>قم بإضافة أو توريد قطع غيار جديدة لتظهر هنا</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>اسم القطعة</th>
                    <th>رقم القطعة</th>
                    <th>سعر الشراء الافتراضي</th>
                    <th>آخر سعر شراء</th>
                    <th>متوسط سعر الشراء</th>
                    <th>سعر البيع</th>
                    <th>هامش الربح</th>
                    <th>الكمية المتوفرة</th>
                    <th>الفرع</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParts.map(part => {
                    const { lastPrice, averagePrice } = getPartPurchaseStats(part.id, part.buy_price);
                    return (
                      <tr key={part.id}>
                        <td className="font-semibold">{part.name}</td>
                        <td>{part.part_number || '—'}</td>
                        <td>{formatCurrency(part.buy_price)}</td>
                        <td>{formatCurrency(lastPrice)}</td>
                        <td>{formatCurrency(averagePrice)}</td>
                        <td>{formatCurrency(part.sell_price)}</td>
                        <td>
                          <span className="text-success font-semibold">{getMargin(part)}</span>
                        </td>
                        <td>
                          <span className={`flex items-center gap-8 ${part.quantity <= (part.min_quantity || 0) ? 'text-danger font-bold' : ''}`}>
                            {part.quantity} حبة
                            {part.quantity <= (part.min_quantity || 0) && (
                              <AlertTriangle size={14} className="text-danger" title="مخزون منخفض!" />
                            )}
                          </span>
                        </td>
                        <td>{CITIES[part.branch] || part.branch}</td>
                        <td>
                          <div className="flex gap-8">
                            <button className="btn btn-ghost btn-sm" onClick={() => openEditPartModal(part)}>
                              <Edit size={16} />
                            </button>
                            <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDeletePart(part)}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Suppliers */}
      {activeTab === 'suppliers' && (
        <div className="invoice-no-print">
          <div className="filter-bar mb-16">
            <div className="search-wrapper">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="بحث باسم المورد أو الشركة أو الهاتف..."
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <select
                className="form-select"
                value={supplierCityFilter}
                onChange={(e) => setSupplierCityFilter(e.target.value)}
              >
                <option value="">كل المدن</option>
                {Object.entries(CITIES).map(([key, val]) => (
                  <option key={key} value={key}>{val}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-container">
            {filteredSuppliers.length === 0 ? (
              <div className="empty-state">
                <Users size={48} className="text-muted" />
                <h3>لا توجد بيانات موردين مسجلة</h3>
                <p>قم بإضافة الموردين لربط فواتير الشراء والتوريد بهم</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>اسم المورد</th>
                    <th>الشركة</th>
                    <th>الهاتف</th>
                    <th>البريد الإلكتروني</th>
                    <th>المدينة</th>
                    <th>العنوان</th>
                    <th>ملاحظات</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.map(sup => (
                    <tr key={sup.id}>
                      <td className="font-semibold">{sup.name}</td>
                      <td>{sup.company_name || '—'}</td>
                      <td>{sup.phone || '—'}</td>
                      <td>{sup.email || '—'}</td>
                      <td>{CITIES[sup.city] || sup.city}</td>
                      <td>{sup.address || '—'}</td>
                      <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={sup.notes}>{sup.notes || '—'}</td>
                      <td>
                        <div className="flex gap-8">
                          <button className="btn btn-ghost btn-sm" onClick={() => openEditSupplierModal(sup)}>
                            <Edit size={16} />
                          </button>
                          <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDeleteSupplier(sup)}>
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
        </div>
      )}

      {/* Tab 3: Purchase Invoices */}
      {activeTab === 'purchases' && (
        <div className="invoice-no-print">
          <div className="stats-grid mb-24">
            <div className="stat-card warning">
              <div className="stat-info">
                <div className="stat-label">عدد فواتير الشراء</div>
                <div className="stat-value">{filteredPurchases.length} فاتورة</div>
              </div>
              <div className="stat-icon warning">
                <FileText size={28} />
              </div>
            </div>
            <div className="stat-card danger">
              <div className="stat-info">
                <div className="stat-label">إجمالي النفقات والمشتريات</div>
                <div className="stat-value">{formatCurrency(totalPurchasesAmount)}</div>
              </div>
              <div className="stat-icon danger">
                <TrendingDown size={28} />
              </div>
            </div>
          </div>

          <div className="filter-bar mb-16">
            <div className="search-wrapper">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="بحث برقم الفاتورة أو المورد..."
                value={purchaseSearch}
                onChange={(e) => setPurchaseSearch(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <select
                className="form-select"
                value={purchaseBranchFilter}
                onChange={(e) => setPurchaseBranchFilter(e.target.value)}
              >
                <option value="">كل فروع التوريد</option>
                {Object.entries(CITIES).map(([key, val]) => (
                  <option key={key} value={key}>{val}</option>
                ))}
              </select>
              <select
                className="form-select"
                value={purchasePaymentFilter}
                onChange={(e) => setPurchasePaymentFilter(e.target.value)}
              >
                <option value="">طرق الدفع</option>
                {Object.entries(PAYMENT_METHODS).map(([key, val]) => (
                  <option key={key} value={key}>{val}</option>
                ))}
              </select>
              <button className="btn btn-secondary" onClick={() => printReport('purchases')} disabled={filteredPurchases.length === 0}>
                <Printer size={18} />
                طباعة تقرير المشتريات
              </button>
            </div>
          </div>

          <div className="table-container">
            {filteredPurchases.length === 0 ? (
              <div className="empty-state">
                <FileText size={48} className="text-muted" />
                <h3>لا توجد فواتير شراء مسجلة</h3>
                <p>سجل فواتير شراء جديدة من الموردين لزيادة المخزون مالياً ومخزنياً</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>رقم فاتورة الشراء</th>
                    <th>المورد</th>
                    <th>الفرع</th>
                    <th>طريقة الدفع</th>
                    <th>إجمالي الشراء</th>
                    <th>الحالة</th>
                    <th>التاريخ</th>
                    <th>ملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPurchases.map(p => (
                    <tr key={p.id}>
                      <td className="font-semibold">{p.purchase_number}</td>
                      <td>{p.suppliers?.name || 'مورد غير محدد'}</td>
                      <td>{CITIES[p.branch] || p.branch}</td>
                      <td>{PAYMENT_METHODS[p.payment_method] || p.payment_method}</td>
                      <td>{formatCurrency(p.total_amount)}</td>
                      <td>
                        <span className="badge badge-success">مدفوعة وموردة</span>
                      </td>
                      <td>{formatDateShort(p.created_at)}</td>
                      <td>{p.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Sales Invoices */}
      {activeTab === 'sales' && (
        <div className="invoice-no-print">
          <div className="stats-grid mb-24">
            <div className="stat-card primary">
              <div className="stat-info">
                <div className="stat-label">عدد فواتير مبيعات قطع الغيار</div>
                <div className="stat-value">{filteredInvoices.length} فاتورة</div>
              </div>
              <div className="stat-icon primary">
                <FileText size={28} />
              </div>
            </div>
            <div className="stat-card success">
              <div className="stat-info">
                <div className="stat-label">إجمالي قيمة المبيعات</div>
                <div className="stat-value">{formatCurrency(invoiceSalesTotal)}</div>
              </div>
              <div className="stat-icon success">
                <TrendingUp size={28} />
              </div>
            </div>
            <div className="stat-card warning">
              <div className="stat-info">
                <div className="stat-label">إجمالي تكلفة الأصناف المباعة</div>
                <div className="stat-value">{formatCurrency(invoiceCostTotal)}</div>
              </div>
              <div className="stat-icon warning">
                <Package size={28} />
              </div>
            </div>
            <div className="stat-card info">
              <div className="stat-info">
                <div className="stat-label">صافي الأرباح المحققة</div>
                <div className="stat-value">{formatCurrency(invoiceProfitTotal)}</div>
              </div>
              <div className="stat-icon info">
                <DollarSign size={28} />
              </div>
            </div>
          </div>

          <div className="filter-bar mb-16">
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
              <button className="btn btn-secondary" onClick={exportInvoicesCsv} disabled={filteredInvoices.length === 0}>
                <Download size={18} />
                تصدير CSV
              </button>
              <button className="btn btn-secondary" onClick={() => printReport('sales')} disabled={filteredInvoices.length === 0}>
                <Printer size={18} />
                طباعة تقرير المبيعات
              </button>
            </div>
          </div>

          <div className="table-container">
            {filteredInvoices.length === 0 ? (
              <div className="empty-state">
                <FileText size={48} className="text-muted" />
                <h3>لا توجد فواتير بيع قطع غيار</h3>
                <p>قم بإنشاء فاتورة بيع لعميل لتسجيل العملية وحسمها من المخزون</p>
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
                    <th>صافي الربح</th>
                    <th>التاريخ</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map(invoice => (
                    <tr key={invoice.id}>
                      <td className="font-semibold">{invoice.invoice_number}</td>
                      <td>{invoice.clients?.name || 'عميل غير محدد'}</td>
                      <td>{invoice.clients?.phone || '—'}</td>
                      <td>{CITIES[invoice.branch] || invoice.branch}</td>
                      <td>{PAYMENT_METHODS[invoice.payment_method] || invoice.payment_method}</td>
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
      )}

      {/* Tab 5: Analytics */}
      {activeTab === 'analytics' && (
        <div className="invoice-no-print">
          <div className="grid-2 mb-24">
            {/* Cash Flow summary of spare parts */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">
                  <BarChart3 size={20} className="text-primary" />
                  حركة المخزن المالية والتدفقات
                </h3>
              </div>
              <div className="card-body">
                <div className="form-row mt-16" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="stat-card success" style={{ padding: '20px' }}>
                    <span className="stat-label" style={{ fontSize: '0.9rem' }}>إجمالي مبيعات القطع</span>
                    <strong className="stat-value" style={{ fontSize: '1.4rem', marginTop: '6px' }}>{formatCurrency(invoices.reduce((s, i) => s + (Number(i.total_amount) || 0), 0))}</strong>
                  </div>
                  <div className="stat-card danger" style={{ padding: '20px' }}>
                    <span className="stat-label" style={{ fontSize: '0.9rem' }}>إجمالي تكلفة المشتريات</span>
                    <strong className="stat-value" style={{ fontSize: '1.4rem', marginTop: '6px' }}>{formatCurrency(purchases.reduce((s, p) => s + (Number(p.total_amount) || 0), 0))}</strong>
                  </div>
                </div>

                <div className="form-group mt-24" style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <span className="text-muted block mb-8">صافي ربح المبيعات الفعلي:</span>
                  <h2 className="text-success font-bold" style={{ fontSize: '1.8rem' }}>
                    {formatCurrency(invoices.reduce((s, i) => s + (Number(i.total_profit) || 0), 0))}
                  </h2>
                </div>
              </div>
            </div>

            {/* Inventory Asset Value summary */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">
                  <Package size={20} className="text-primary" />
                  تقييم المخزون الحالي
                </h3>
              </div>
              <div className="card-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e2e8f0', paddingBottom: '12px' }}>
                    <span className="text-muted">إجمالي الأصناف المختلفة:</span>
                    <strong>{parts.length} صنف</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e2e8f0', paddingBottom: '12px' }}>
                    <span className="text-muted">إجمالي حبات القطع المتوفرة:</span>
                    <strong>{parts.reduce((sum, p) => sum + (p.quantity || 0), 0)} حبة</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e2e8f0', paddingBottom: '12px' }}>
                    <span className="text-muted">قيمة المخزون الحالي (بسعر التكلفة):</span>
                    <strong className="text-primary">{formatCurrency(inventoryValue)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted">الأرباح المتوقعة للمخزون الحالي:</span>
                    <strong className="text-success">{formatCurrency(expectedProfit)}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid-2">
            {/* Top 5 Most Sold */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title text-success">
                  <TrendingUp size={20} />
                  القطع الأكثر مبيعاً (الأعلى مبيعاً)
                </h3>
              </div>
              <div className="card-body">
                {analyticsData.mostSold.length === 0 ? (
                  <p className="text-muted text-center py-24">لا توجد مبيعات مسجلة بعد للقطع</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {analyticsData.mostSold.map((item, idx) => {
                      const maxQty = analyticsData.mostSold[0]?.qtySold || 1;
                      const percentage = ((item.qtySold / maxQty) * 100).toFixed(0);
                      return (
                        <div key={item.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <div>
                              <strong style={{ fontSize: '1.05rem', color: '#1e293b' }}>{idx + 1}. {item.name}</strong>
                              <span className="text-muted" style={{ fontSize: '0.8rem', display: 'block' }}>رقم القطعة: {item.part_number || '—'}</span>
                            </div>
                            <strong className="text-success">{item.qtySold} حبة مباعة</strong>
                          </div>
                          {/* Progress bar */}
                          <div style={{ width: '100%', height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden' }}>
                            <div style={{ width: `${percentage}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #34d399)', borderRadius: '5px' }}></div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                            <span>المبيعات: {formatCurrency(item.revenue)}</span>
                            <span>الربح: {formatCurrency(item.profit)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Top 5 Least Sold */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title text-danger">
                  <TrendingDown size={20} />
                  القطع الراكدة / الأقل مبيعاً (Dead Stock)
                </h3>
              </div>
              <div className="card-body">
                {analyticsData.leastSold.length === 0 ? (
                  <p className="text-muted text-center py-24">لا توجد قطع غيار مسجلة بالمخزن</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p className="text-muted mb-16" style={{ fontSize: '0.85rem' }}>القطع التالية هي الأقل طلباً أو التي لم يتم بيع أي حبات منها إطلاقاً، وتطلب المتابعة للتصفية:</p>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>الترتيب</th>
                          <th>اسم القطعة</th>
                          <th>رقم القطعة</th>
                          <th>الكميات المباعة</th>
                          <th>المتوفر بالمستودع</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analyticsData.leastSold.map((part, idx) => (
                          <tr key={part.id}>
                            <td className="font-semibold">{idx + 1}</td>
                            <td className="font-semibold text-danger">{part.name}</td>
                            <td>{part.part_number || '—'}</td>
                            <td>
                              <span className="badge badge-secondary">{part.qtySold} حبة</span>
                            </td>
                            <td><strong>{part.quantityInStock} حبة</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Parts Modal */}
      {showPartModal && (
        <div className="modal-overlay" onClick={() => setShowPartModal(false)}>
          <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingPart ? 'تعديل بيانات قطعة الغيار' : 'إضافة صنف قطعة غيار جديد'}
              </h2>
              <button className="modal-close" onClick={() => setShowPartModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSavePart}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">اسم القطعة *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={partFormData.name}
                      onChange={(e) => setPartFormData({ ...partFormData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">رقم القطعة / الكود المرجعي</label>
                    <input
                      type="text"
                      className="form-input"
                      value={partFormData.part_number}
                      onChange={(e) => setPartFormData({ ...partFormData, part_number: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">سعر الشراء الكلفوي (ر.س) *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={partFormData.buy_price}
                      onChange={(e) => setPartFormData({ ...partFormData, buy_price: e.target.value })}
                      required
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">سعر البيع المقترح (ر.س) *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={partFormData.sell_price}
                      onChange={(e) => setPartFormData({ ...partFormData, sell_price: e.target.value })}
                      required
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">الكمية الافتتاحية *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={partFormData.quantity}
                      onChange={(e) => setPartFormData({ ...partFormData, quantity: e.target.value })}
                      required
                      min="0"
                      disabled={!!editingPart} // update qty only via purchase invoice for accuracy
                      title={editingPart ? 'الكمية تُعدل عبر فواتير المشتريات والمبيعات فقط لدقة الحسابات' : ''}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">الحد الأدنى للتنبيه (النفاد)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={partFormData.min_quantity}
                      onChange={(e) => setPartFormData({ ...partFormData, min_quantity: e.target.value })}
                      min="0"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">الفئة التصنيفية</label>
                    <input
                      type="text"
                      className="form-input"
                      value={partFormData.category}
                      onChange={(e) => setPartFormData({ ...partFormData, category: e.target.value })}
                      placeholder="محركات، بوردات، أبواب، سيور..."
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">الفرع *</label>
                    <select
                      className="form-select"
                      value={partFormData.branch}
                      onChange={(e) => setPartFormData({ ...partFormData, branch: e.target.value })}
                      required
                    >
                      {Object.entries(CITIES).map(([key, val]) => (
                        <option key={key} value={key}>{val}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">وصف وملاحظات إضافية</label>
                  <textarea
                    className="form-textarea"
                    value={partFormData.notes}
                    onChange={(e) => setPartFormData({ ...partFormData, notes: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="submit" className="btn btn-primary" disabled={partSaving}>
                  {partSaving ? 'جاري الحفظ...' : (editingPart ? 'تحديث البيانات' : 'إضافة للمستودع')}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPartModal(false)}>
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Suppliers Modal */}
      {showSupplierModal && (
        <div className="modal-overlay" onClick={() => setShowSupplierModal(false)}>
          <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingSupplier ? 'تعديل بيانات المورد' : 'تسجيل مورد جديد'}
              </h2>
              <button className="modal-close" onClick={() => setShowSupplierModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveSupplier}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">اسم المورد *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={supplierFormData.name}
                      onChange={(e) => setSupplierFormData({ ...supplierFormData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">اسم الشركة التابع لها</label>
                    <input
                      type="text"
                      className="form-input"
                      value={supplierFormData.company_name}
                      onChange={(e) => setSupplierFormData({ ...supplierFormData, company_name: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">رقم الهاتف والتواصل</label>
                    <input
                      type="text"
                      className="form-input"
                      value={supplierFormData.phone}
                      onChange={(e) => setSupplierFormData({ ...supplierFormData, phone: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">البريد الإلكتروني</label>
                    <input
                      type="email"
                      className="form-input"
                      value={supplierFormData.email}
                      onChange={(e) => setSupplierFormData({ ...supplierFormData, email: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">المدينة *</label>
                    <select
                      className="form-select"
                      value={supplierFormData.city}
                      onChange={(e) => setSupplierFormData({ ...supplierFormData, city: e.target.value })}
                      required
                    >
                      {Object.entries(CITIES).map(([key, val]) => (
                        <option key={key} value={key}>{val}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">العنوان بالتفصيل</label>
                    <input
                      type="text"
                      className="form-input"
                      value={supplierFormData.address}
                      onChange={(e) => setSupplierFormData({ ...supplierFormData, address: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">ملاحظات وشروط التوريد</label>
                  <textarea
                    className="form-textarea"
                    value={supplierFormData.notes}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, notes: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="submit" className="btn btn-primary" disabled={supplierSaving}>
                  {supplierSaving ? 'جاري الحفظ...' : (editingSupplier ? 'تحديث البيانات' : 'تسجيل المورد')}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowSupplierModal(false)}>
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reports Printing container */}
      {printReportActive && (
        <div className="print-only-container">
          <PrintHeader />
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <span style={{ fontSize: '1rem', color: '#555' }}>
              {printReportType === 'sales' ? 'تقرير مبيعات قطع الغيار والمخزن' : printReportType === 'purchases' ? 'تقرير مشتريات وتوريد قطع الغيار' : 'كشف جرد مستودع قطع الغيار'}
            </span>
          </div>

          <div className="print-title">
            {printReportType === 'sales' ? 'تقرير فواتير مبيعات قطع الغيار' : printReportType === 'purchases' ? 'تقرير فواتير مشتريات المستودع' : 'كشف جرد ومحتويات المستودع'}
          </div>

          {printReportType === 'parts' && (
            <>
              <div className="print-meta-grid">
                <div className="print-meta-item"><span>عدد الأصناف</span><strong>{parts.length} صنف</strong></div>
                <div className="print-meta-item"><span>إجمالي حبات التوفر</span><strong>{parts.reduce((s, p) => s + (p.quantity || 0), 0)} حبة</strong></div>
                <div className="print-meta-item"><span>قيمة جرد المستودع (تكلفة)</span><strong>{formatCurrency(inventoryValue)}</strong></div>
                <div className="print-meta-item"><span>الأرباح المتوقعة</span><strong>{formatCurrency(expectedProfit)}</strong></div>
              </div>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>اسم الصنف</th>
                    <th>رقم الصنف</th>
                    <th>سعر الشراء الافتراضي</th>
                    <th>آخر سعر شراء</th>
                    <th>متوسط سعر الشراء</th>
                    <th>سعر البيع</th>
                    <th>الكمية المتوفرة</th>
                    <th>الفرع</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParts.map(part => {
                    const { lastPrice, averagePrice } = getPartPurchaseStats(part.id, part.buy_price);
                    return (
                      <tr key={part.id}>
                        <td>{part.name}</td>
                        <td>{part.part_number || '-'}</td>
                        <td>{formatCurrency(part.buy_price)}</td>
                        <td>{formatCurrency(lastPrice)}</td>
                        <td>{formatCurrency(averagePrice)}</td>
                        <td>{formatCurrency(part.sell_price)}</td>
                        <td>{part.quantity} حبة</td>
                        <td>{CITIES[part.branch] || part.branch}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}

          {printReportType === 'purchases' && (
            <>
              <div className="print-meta-grid">
                <div className="print-meta-item"><span>عدد فواتير الشراء</span><strong>{filteredPurchases.length} فاتورة</strong></div>
                <div className="print-meta-item"><span>إجمالي قيمة المشتريات</span><strong>{formatCurrency(totalPurchasesAmount)}</strong></div>
              </div>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>رقم الفاتورة</th>
                    <th>المورد</th>
                    <th>الفرع</th>
                    <th>طريقة الدفع</th>
                    <th>الإجمالي</th>
                    <th>التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPurchases.map(p => (
                    <tr key={p.id}>
                      <td>{p.purchase_number}</td>
                      <td>{p.suppliers?.name || '-'}</td>
                      <td>{CITIES[p.branch] || p.branch}</td>
                      <td>{PAYMENT_METHODS[p.payment_method] || p.payment_method}</td>
                      <td>{formatCurrency(p.total_amount)}</td>
                      <td>{formatDateShort(p.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {printReportType === 'sales' && (
            <>
              <div className="print-meta-grid">
                <div className="print-meta-item"><span>عدد الفواتير</span><strong>{filteredInvoices.length} فاتورة</strong></div>
                <div className="print-meta-item"><span>إجمالي المبيعات</span><strong>{formatCurrency(invoiceSalesTotal)}</strong></div>
                <div className="print-meta-item"><span>إجمالي التكلفة</span><strong>{formatCurrency(invoiceCostTotal)}</strong></div>
                <div className="print-meta-item"><span>صافي الأرباح المحصلة</span><strong>{formatCurrency(invoiceProfitTotal)}</strong></div>
              </div>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>رقم الفاتورة</th>
                    <th>العميل</th>
                    <th>الفرع</th>
                    <th>طريقة الدفع</th>
                    <th>إجمالي البيع</th>
                    <th>صافي الربح</th>
                    <th>التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map(invoice => (
                    <tr key={invoice.id}>
                      <td>{invoice.invoice_number}</td>
                      <td>{invoice.clients?.name || '-'}</td>
                      <td>{CITIES[invoice.branch] || invoice.branch}</td>
                      <td>{PAYMENT_METHODS[invoice.payment_method] || invoice.payment_method}</td>
                      <td>{formatCurrency(invoice.total_amount)}</td>
                      <td>{formatCurrency(invoice.total_profit)}</td>
                      <td>{formatDateShort(invoice.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div className="print-footer" style={{ marginTop: '40px' }}>
            <div className="print-signature">
              <span>أمين المستودع والمخازن</span>
              <strong>التوقيع: ..........................</strong>
            </div>
            <div className="print-signature">
              <span>مدير عام الشؤون المالية</span>
              <strong>التوقيع والختم الرسمي</strong>
            </div>
          </div>

          <PrintFooter />
        </div>
      )}
    </div>
  );
}

export default SpareParts;
