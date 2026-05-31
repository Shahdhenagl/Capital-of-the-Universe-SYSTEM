import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Printer, FileText } from 'lucide-react';
import { supabase, CITIES, PAYMENT_METHODS, formatCurrency, formatDate } from '../lib/supabase';

export default function SparePartsInvoiceDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [client, setClient] = useState(null);
  const [items, setItems] = useState([]);
  const [creator, setCreator] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  async function fetchInvoice() {
    try {
      setLoading(true);
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('spare_parts_invoices')
        .select('*')
        .eq('id', id)
        .single();

      if (invoiceError) throw invoiceError;
      setInvoice(invoiceData);

      const [clientRes, itemsRes, creatorRes] = await Promise.all([
        supabase.from('clients').select('*').eq('id', invoiceData.client_id).single(),
        supabase
          .from('spare_parts_invoice_items')
          .select('*, spare_parts(name, part_number)')
          .eq('invoice_id', invoiceData.id),
        invoiceData.created_by
          ? supabase.from('profiles').select('full_name, email').eq('id', invoiceData.created_by).single()
          : Promise.resolve({ data: null })
      ]);

      if (clientRes.error) throw clientRes.error;
      if (itemsRes.error) throw itemsRes.error;
      setClient(clientRes.data);
      setItems(itemsRes.data || []);
      setCreator(creatorRes.data || null);
    } catch (err) {
      console.error('Error fetching spare parts invoice:', err);
      alert(`تعذر تحميل الفاتورة: ${err.message || 'خطأ غير معروف'}`);
      navigate('/spare-parts');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="loading-inline">
        <div className="loader"></div>
      </div>
    );
  }

  if (!invoice) return null;

  return (
    <div>
      <div className="page-header invoice-no-print">
        <h1 className="page-title">
          <span className="title-icon" style={{ background: 'var(--success-bg)', color: 'var(--success-light)' }}>
            <FileText size={28} />
          </span>
          فاتورة قطع غيار
        </h1>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => navigate('/spare-parts')}>
            <ArrowRight size={18} />
            العودة
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Printer size={18} />
            طباعة
          </button>
        </div>
      </div>

      <div className="invoice-sheet">
        <div className="invoice-brand">
          <img src="/logo-transparent.png" alt="عاصمة الكون FUJI-YEM Elevators" />
          <div>
            <h2>عاصمة الكون</h2>
            <p>FUJI-YEM Elevators</p>
          </div>
        </div>

        <div className="invoice-title-row">
          <div>
            <p className="text-muted">رقم الفاتورة</p>
            <h2>{invoice.invoice_number}</h2>
          </div>
          <div>
            <p className="text-muted">التاريخ</p>
            <h3>{formatDate(invoice.created_at)}</h3>
          </div>
        </div>

        <div className="invoice-meta-grid">
          <div>
            <span>العميل</span>
            <strong>{client?.name || '-'}</strong>
          </div>
          <div>
            <span>الهاتف</span>
            <strong>{client?.phone || '-'}</strong>
          </div>
          <div>
            <span>الفرع</span>
            <strong>{CITIES[invoice.branch] || invoice.branch}</strong>
          </div>
          <div>
            <span>طريقة الدفع</span>
            <strong>{PAYMENT_METHODS[invoice.payment_method] || invoice.payment_method}</strong>
          </div>
          <div>
            <span>أنشأها</span>
            <strong>{creator?.full_name || creator?.email || '-'}</strong>
          </div>
          <div>
            <span>الحالة</span>
            <strong>{invoice.status || '-'}</strong>
          </div>
        </div>

        <table className="data-table invoice-table">
          <thead>
            <tr>
              <th>القطعة</th>
              <th>رقم القطعة</th>
              <th>الكمية</th>
              <th>سعر البيع</th>
              <th>التكلفة</th>
              <th>الإجمالي</th>
              <th>الربح</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td>{item.spare_parts?.name || '-'}</td>
                <td>{item.spare_parts?.part_number || '-'}</td>
                <td>{item.quantity}</td>
                <td>{formatCurrency(item.unit_sell_price)}</td>
                <td>{formatCurrency(item.unit_buy_price)}</td>
                <td>{formatCurrency(item.total_price)}</td>
                <td>{formatCurrency(item.profit)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="invoice-summary">
          <div><span>إجمالي البيع</span><strong>{formatCurrency(invoice.total_amount)}</strong></div>
          <div><span>إجمالي التكلفة</span><strong>{formatCurrency(invoice.total_cost)}</strong></div>
          <div><span>صافي الربح</span><strong>{formatCurrency(invoice.total_profit)}</strong></div>
        </div>

        {invoice.notes && (
          <div className="invoice-notes">
            <span>ملاحظات</span>
            <p>{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
