import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, formatCurrency, CITIES, PAYMENT_METHODS, logActivity } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Plus, Trash2, Save, ArrowRight, Package, DollarSign } from 'lucide-react';
import { notifyIntegrations } from '../lib/integrations';

function SparePartsInvoice() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [spareParts, setSpareParts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [clientId, setClientId] = useState('');
  const [branch, setBranch] = useState('mecca');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([
    { spare_part_id: '', quantity: 1, unit_price: 0, buy_price: 0 }
  ]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [clientsRes, partsRes] = await Promise.all([
        supabase.from('clients').select('id, name').order('name'),
        supabase.from('spare_parts').select('*').gt('quantity', 0).order('name')
      ]);
      setClients(clientsRes.data || []);
      setSpareParts(partsRes.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }

  function addItem() {
    setItems([...items, { spare_part_id: '', quantity: 1, unit_price: 0, buy_price: 0 }]);
  }

  function removeItem(index) {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index, field, value) {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'spare_part_id') {
      const part = spareParts.find(p => p.id === value);
      if (part) {
        updated[index].unit_price = part.sell_price || 0;
        updated[index].buy_price = part.buy_price || 0;
      }
    }

    setItems(updated);
  }

  const totalSell = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  const totalCost = items.reduce((sum, item) => sum + (item.buy_price * item.quantity), 0);
  const netProfit = totalSell - totalCost;

  async function generateInvoiceNumber() {
    const { data } = await supabase
      .from('spare_parts_invoices')
      .select('invoice_number')
      .order('created_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const lastNum = parseInt(data[0].invoice_number?.replace('SPI', '') || '0');
      return 'SPI' + String(lastNum + 1).padStart(5, '0');
    }
    return 'SPI00001';
  }

  async function handleSave() {
    if (!clientId) {
      alert('يرجى اختيار العميل');
      return;
    }

    const validItems = items.filter(item => item.spare_part_id);
    if (validItems.length === 0) {
      alert('يرجى إضافة قطعة واحدة على الأقل');
      return;
    }

    for (const item of validItems) {
      const part = spareParts.find(p => p.id === item.spare_part_id);
      if (part && item.quantity > part.quantity) {
        alert(`الكمية المطلوبة من "${part.name}" أكبر من المتوفر (${part.quantity})`);
        return;
      }
    }

    setSaving(true);
    try {
      const invoiceNumber = await generateInvoiceNumber();

      const { data: invoice, error: invoiceError } = await supabase
        .from('spare_parts_invoices')
        .insert({
          invoice_number: invoiceNumber,
          client_id: clientId,
          branch,
          payment_method: paymentMethod,
          total_amount: totalSell,
          total_cost: totalCost,
          total_profit: netProfit,
          notes,
          created_by: profile?.id
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      const invoiceItems = validItems.map(item => ({
        invoice_id: invoice.id,
        spare_part_id: item.spare_part_id,
        quantity: item.quantity,
        unit_buy_price: item.buy_price,
        unit_sell_price: item.unit_price,
        total_price: item.unit_price * item.quantity,
        total_cost: item.buy_price * item.quantity,
        profit: (item.unit_price - item.buy_price) * item.quantity
      }));

      const { error: itemsError } = await supabase
        .from('spare_parts_invoice_items')
        .insert(invoiceItems);

      if (itemsError) throw itemsError;

      for (const item of validItems) {
        const part = spareParts.find(p => p.id === item.spare_part_id);
        if (part) {
          await supabase
            .from('spare_parts')
            .update({ quantity: part.quantity - item.quantity })
            .eq('id', item.spare_part_id);
        }
      }

      await supabase.from('revenues').insert({
        client_id: clientId,
        amount: totalSell,
        branch,
        description: `فاتورة بيع قطع غيار رقم ${invoiceNumber}`,
        created_by: profile?.id,
        created_by_name: profile?.full_name
      });

      const client = clients.find(c => c.id === clientId);
      const invoiceLink = `/spare-parts/invoices/${invoice.id}`;
      const itemsSummary = validItems.map(item => {
        const part = spareParts.find(p => p.id === item.spare_part_id);
        return `- ${part?.name || 'قطعة'} x ${item.quantity} = ${formatCurrency(item.unit_price * item.quantity)}`;
      });

      await logActivity(
        profile?.id,
        profile?.full_name,
        'إنشاء',
        'فواتير قطع الغيار',
        invoice.id,
        `تم إنشاء فاتورة بيع قطع غيار رقم ${invoiceNumber} للعميل ${client?.name || ''} بمبلغ ${formatCurrency(totalSell)}`,
        branch
      );

      await notifyIntegrations({
        title: 'فاتورة قطع غيار جديدة',
        message: `تم إنشاء فاتورة قطع غيار رقم ${invoiceNumber} للعميل ${client?.name || ''}`,
        actor: profile?.full_name || profile?.email || 'مستخدم غير معروف',
        amount: formatCurrency(totalSell),
        branch: CITIES[branch] || branch,
        lines: [
          `طريقة الدفع: ${PAYMENT_METHODS[paymentMethod] || paymentMethod}`,
          `إجمالي التكلفة: ${formatCurrency(totalCost)}`,
          `صافي الربح: ${formatCurrency(netProfit)}`,
          'القطع:',
          ...itemsSummary
        ],
        link: invoiceLink
      });

      alert(`تم إنشاء الفاتورة رقم ${invoiceNumber} بنجاح`);
      navigate(invoiceLink);
    } catch (err) {
      console.error('Error saving invoice:', err);
      alert(`حدث خطأ أثناء حفظ الفاتورة: ${err.message || 'خطأ غير معروف'}`);
    } finally {
      setSaving(false);
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
          <span className="title-icon" style={{ background: 'var(--success-bg)', color: 'var(--success-light)' }}>
            <FileText size={28} />
          </span>
          فاتورة بيع قطع غيار
        </h1>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => navigate('/spare-parts')}>
            <ArrowRight size={18} />
            العودة لقطع الغيار
          </button>
        </div>
      </div>

      <div className="card mb-24">
        <div className="card-header">
          <h3 className="card-title">
            <Package size={20} />
            بيانات الفاتورة
          </h3>
        </div>
        <div className="card-body">
          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label">العميل *</label>
              <select
                className="form-select"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
                <option value="">اختر العميل</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">الفرع</label>
              <select
                className="form-select"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              >
                <option value="mecca">مكة المكرمة</option>
                <option value="jeddah">جدة</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">طريقة الدفع</label>
              <select
                className="form-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="cash">كاش</option>
                <option value="visa">فيزا</option>
                <option value="bank_transfer">تحويل بنكي</option>
                <option value="other">أخرى</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-24">
        <div className="card-header">
          <h3 className="card-title">
            <Package size={20} />
            القطع المباعة
          </h3>
          <button className="btn btn-primary btn-sm" onClick={addItem}>
            <Plus size={16} />
            إضافة قطعة
          </button>
        </div>
        <div className="card-body">
          <table className="data-table">
            <thead>
              <tr>
                <th>القطعة</th>
                <th>الكمية</th>
                <th>سعر الوحدة</th>
                <th>الإجمالي</th>
                <th>حذف</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td>
                    <select
                      className="form-select"
                      value={item.spare_part_id}
                      onChange={(e) => updateItem(index, 'spare_part_id', e.target.value)}
                    >
                      <option value="">اختر القطعة</option>
                      {spareParts.map(part => (
                        <option key={part.id} value={part.id}>
                          {part.name} ({part.part_number || '—'}) — متوفر: {part.quantity}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      className="form-input"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                      min="1"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="form-input"
                      value={item.unit_price}
                      onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                    />
                  </td>
                  <td>
                    <span className="font-bold">{formatCurrency(item.unit_price * item.quantity)}</span>
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm text-danger"
                      onClick={() => removeItem(index)}
                      disabled={items.length <= 1}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mb-24">
        <div className="card-header">
          <h3 className="card-title">
            <DollarSign size={20} />
            ملخص الفاتورة
          </h3>
        </div>
        <div className="card-body">
          <div className="form-row-3">
            <div className="stat-card success">
              <div className="stat-info">
                <div className="stat-label">إجمالي البيع</div>
                <div className="stat-value">{formatCurrency(totalSell)}</div>
              </div>
            </div>
            <div className="stat-card warning">
              <div className="stat-info">
                <div className="stat-label">إجمالي التكلفة</div>
                <div className="stat-value">{formatCurrency(totalCost)}</div>
              </div>
            </div>
            <div className="stat-card primary">
              <div className="stat-info">
                <div className="stat-label">صافي الربح</div>
                <div className="stat-value">{formatCurrency(netProfit)}</div>
              </div>
            </div>
          </div>

          <div className="form-group mt-24">
            <label className="form-label">ملاحظات</label>
            <textarea
              className="form-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="ملاحظات إضافية على الفاتورة..."
            />
          </div>
        </div>
      </div>

      <div className="flex gap-12">
        <button className="btn btn-success btn-lg" onClick={handleSave} disabled={saving}>
          <Save size={20} />
          {saving ? 'جاري الحفظ...' : 'حفظ الفاتورة'}
        </button>
        <button className="btn btn-secondary btn-lg" onClick={() => navigate('/spare-parts')}>
          إلغاء
        </button>
      </div>
    </div>
  );
}

export default SparePartsInvoice;
