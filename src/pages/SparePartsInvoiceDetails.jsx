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
      {/* Screen layout wrapped in invoice-no-print */}
      <div className="invoice-no-print">
        <div className="page-header">
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

      {/* Print PDF Vector Document Section (for clients, strictly hides cost and profit) */}
      <div className="print-only-container">
        <div className="print-header">
          <div className="print-logo-section">
            <span style={{ fontSize: '2rem' }}>🏗️</span>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>شركة عاصمة الكون للمصاعد</h1>
              <span style={{ fontSize: '0.85rem', color: '#555' }}>فاتورة بيع قطع غيار ومستلزمات</span>
            </div>
          </div>
          <div style={{ textAlign: 'left', direction: 'ltr' }}>
            <p style={{ margin: '0 0 5px 0' }}>رقم الفاتورة: <strong>{invoice.invoice_number}</strong></p>
            <p style={{ margin: 0 }}>التاريخ: {formatDate(invoice.created_at)}</p>
          </div>
        </div>

        <div className="print-title" style={{ fontSize: '1.4rem', fontWeight: 800, textAlign: 'center', margin: '20px 0', color: '#0f766e', borderBottom: '1px dashed #ccc', paddingBottom: '10px' }}>
          فاتورة مبيعات قطع غيار
        </div>

        <div className="print-meta-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
          <div className="print-meta-item" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '3px' }}>الطرف الأول (المورد)</span>
            <strong style={{ fontSize: '1rem', color: '#0f172a' }}>شركة عاصمة الكون للمصاعد</strong>
          </div>
          <div className="print-meta-item" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '3px' }}>الطرف الثاني (العميل)</span>
            <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{client?.name || '-'}</strong>
          </div>
          <div className="print-meta-item" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '3px' }}>رقم الهاتف</span>
            <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{client?.phone || '-'}</strong>
          </div>
          <div className="print-meta-item" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '3px' }}>طريقة الدفع / فرع المعاملة</span>
            <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{PAYMENT_METHODS[invoice.payment_method] || invoice.payment_method} / {CITIES[invoice.branch] || invoice.branch}</strong>
          </div>
        </div>

        <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
          <thead>
            <tr style={{ background: '#ecfeff' }}>
              <th style={{ border: '1px solid #cbd5e1', padding: '8px 10px', textAlign: 'right' }}>القطعة</th>
              <th style={{ border: '1px solid #cbd5e1', padding: '8px 10px', textAlign: 'right' }}>رقم القطعة</th>
              <th style={{ border: '1px solid #cbd5e1', padding: '8px 10px', textAlign: 'right' }}>الكمية</th>
              <th style={{ border: '1px solid #cbd5e1', padding: '8px 10px', textAlign: 'right' }}>سعر البيع</th>
              <th style={{ border: '1px solid #cbd5e1', padding: '8px 10px', textAlign: 'right' }}>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px 10px', textAlign: 'right' }}>{item.spare_parts?.name || '-'}</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px 10px', textAlign: 'right' }}>{item.spare_parts?.part_number || '-'}</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px 10px', textAlign: 'right' }}>{item.quantity}</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px 10px', textAlign: 'right' }}>{formatCurrency(item.unit_sell_price)}</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px 10px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(item.total_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <div style={{
            border: '2px solid #0f766e',
            borderRadius: '8px',
            padding: '12px 24px',
            background: '#f0fdfa',
            textAlign: 'center',
            minWidth: '220px'
          }}>
            <span style={{ fontSize: '0.85rem', color: '#0f766e', display: 'block', marginBottom: '4px' }}>المبلغ الإجمالي الخاضع للطلب</span>
            <strong style={{ fontSize: '1.4rem', color: '#0f172a' }}>{formatCurrency(invoice.total_amount)}</strong>
          </div>
        </div>

        {invoice.notes && (
          <div style={{ marginTop: '35px', borderTop: '1px dashed #ccc', paddingTop: '15px' }}>
            <span style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px', color: '#475569' }}>شروط وأحكام / ملاحظات:</span>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', lineHeight: '1.6' }}>{invoice.notes}</p>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px', padding: '0 20px' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: '0 0 45px 0', color: '#475569', fontSize: '0.9rem' }}>توقيع الطرف الثاني (العميل)</p>
            <div style={{ borderBottom: '1.5px solid #94a3b8', width: '160px', margin: '0 auto' }}></div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: '0 0 45px 0', color: '#475569', fontSize: '0.9rem' }}>الختم والاعتماد (عاصمة الكون)</p>
            <div style={{ borderBottom: '1.5px solid #94a3b8', width: '160px', margin: '0 auto' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
