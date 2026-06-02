import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, formatCurrency, CITIES, PAYMENT_METHODS, logActivity } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Plus, Trash2, Save, ArrowRight, Package, DollarSign } from 'lucide-react';
import { notifyIntegrations } from '../lib/integrations';

function SparePartsPurchaseInvoice() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [spareParts, setSpareParts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [supplierId, setSupplierId] = useState('');
  const [branch, setBranch] = useState('mecca');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([
    { spare_part_id: '', quantity: 1, unit_price: 0 }
  ]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [suppliersRes, partsRes] = await Promise.all([
        supabase.from('suppliers').select('id, name').order('name'),
        supabase.from('spare_parts').select('*').order('name')
      ]);
      setSuppliers(suppliersRes.data || []);
      setSpareParts(partsRes.data || []);
    } catch (err) {
      console.error('Error fetching purchase invoice data:', err);
    } finally {
      setLoading(false);
    }
  }

  function addItem() {
    setItems([...items, { spare_part_id: '', quantity: 1, unit_price: 0 }]);
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
        updated[index].unit_price = part.buy_price || 0;
      }
    }

    setItems(updated);
  }

  const totalBuy = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

  async function generatePurchaseNumber() {
    const { data } = await supabase
      .from('spare_parts_purchases')
      .select('purchase_number')
      .order('created_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const lastNum = parseInt(data[0].purchase_number?.replace('SPP', '') || '0');
      return 'SPP' + String(lastNum + 1).padStart(5, '0');
    }
    return 'SPP00001';
  }

  async function handleSave() {
    if (!supplierId) {
      alert('يرجى اختيار المورد');
      return;
    }

    const validItems = items.filter(item => item.spare_part_id);
    if (validItems.length === 0) {
      alert('يرجى إضافة قطعة واحدة على الأقل');
      return;
    }

    setSaving(true);
    try {
      const purchaseNumber = await generatePurchaseNumber();

      // 1. Insert Purchase Invoice
      const { data: purchase, error: purchaseError } = await supabase
        .from('spare_parts_purchases')
        .insert({
          purchase_number: purchaseNumber,
          supplier_id: supplierId,
          branch,
          payment_method: paymentMethod,
          total_amount: totalBuy,
          notes,
          created_by: profile?.id
        })
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      // 2. Insert Purchase Items
      const purchaseItems = validItems.map(item => ({
        purchase_id: purchase.id,
        spare_part_id: item.spare_part_id,
        quantity: item.quantity,
        unit_buy_price: item.unit_price,
        total_price: item.unit_price * item.quantity
      }));

      const { error: itemsError } = await supabase
        .from('spare_parts_purchase_items')
        .insert(purchaseItems);

      if (itemsError) throw itemsError;

      // 3. Update stock quantities and update unit buy_price to reflect latest cost
      for (const item of validItems) {
        const part = spareParts.find(p => p.id === item.spare_part_id);
        if (part) {
          await supabase
            .from('spare_parts')
            .update({
              quantity: part.quantity + item.quantity,
              buy_price: item.unit_price // update cost price to latest buy price
            })
            .eq('id', item.spare_part_id);
        }
      }

      // 4. Fetch or Create Expense Category "مشتريات قطع غيار"
      let categoryId = null;
      const { data: catData } = await supabase
        .from('expense_categories')
        .select('id')
        .eq('name', 'مشتريات قطع غيار')
        .maybeSingle();

      if (catData) {
        categoryId = catData.id;
      } else {
        const { data: newCat } = await supabase
          .from('expense_categories')
          .insert({ name: 'مشتريات قطع غيار', description: 'مشتريات قطع الغيار والمخزون من الموردين' })
          .select()
          .single();
        if (newCat) {
          categoryId = newCat.id;
        }
      }

      // 5. Book instant expense in accounting register
      const supplierName = suppliers.find(s => s.id === supplierId)?.name || 'المورد';
      const expenseDesc = `فاتورة شراء قطع غيار رقم ${purchaseNumber} من المورد ${supplierName}`;
      const { error: expError } = await supabase.from('expenses').insert({
        category_id: categoryId,
        amount: totalBuy,
        description: expenseDesc,
        branch,
        created_by: profile?.id,
        created_by_name: profile?.full_name
      });

      if (expError) console.error('Error logging purchase as expense:', expError);

      const itemsSummary = validItems.map(item => {
        const part = spareParts.find(p => p.id === item.spare_part_id);
        return `- ${part?.name || 'قطعة'} x ${item.quantity} = ${formatCurrency(item.unit_price * item.quantity)}`;
      });

      await logActivity(
        profile?.id,
        profile?.full_name,
        'إنشاء',
        'مشتريات قطع الغيار',
        purchase.id,
        `تم إنشاء فاتورة شراء قطع غيار رقم ${purchaseNumber} من المورد ${supplierName} بمبلغ ${formatCurrency(totalBuy)}`,
        branch
      );

      await notifyIntegrations({
        title: 'فاتورة شراء قطع غيار جديدة',
        message: `تم شراء قطع غيار رقم ${purchaseNumber} من المورد ${supplierName}`,
        actor: profile?.full_name || profile?.email || 'مستخدم غير معروف',
        amount: formatCurrency(totalBuy),
        branch: CITIES[branch] || branch,
        lines: [
          `طريقة الدفع: ${PAYMENT_METHODS[paymentMethod] || paymentMethod}`,
          `تفاصيل القطع المشتراة:`,
          ...itemsSummary
        ],
        link: '/spare-parts'
      });

      alert(`تم تسجيل فاتورة الشراء رقم ${purchaseNumber} بنجاح وزيادة المخزون وتسجيل المصروف`);
      navigate('/spare-parts');
    } catch (err) {
      console.error('Error saving purchase invoice:', err);
      alert(`حدث خطأ أثناء حفظ فاتورة الشراء: ${err.message || 'خطأ غير معروف'}`);
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
    <div dir="rtl">
      <div className="page-header">
        <h1 className="page-title">
          <span className="title-icon" style={{ background: 'var(--primary-bg)', color: 'var(--primary-light)' }}>
            <FileText size={28} />
          </span>
          فاتورة شراء قطع غيار (موردين)
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
            بيانات فاتورة الشراء والتوريد
          </h3>
        </div>
        <div className="card-body">
          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label">المورد *</label>
              <select
                className="form-select"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                required
              >
                <option value="">اختر المورد</option>
                {suppliers.map(sup => (
                  <option key={sup.id} value={sup.id}>{sup.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">فرع التخزين والتحصيل</label>
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
              <label className="form-label">طريقة الدفع (الخزنة)</label>
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
            أصناف القطع المشتراة
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
                <th>الكمية المشتراة</th>
                <th>سعر الشراء (ر.س)</th>
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
                          {part.name} ({part.part_number || '—'}) — متوفر حالياً: {part.quantity}
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
            ملخص الفاتورة والحسابات المالية
          </h3>
        </div>
        <div className="card-body">
          <div className="form-row-3">
            <div className="stat-card warning" style={{ maxWidth: '400px' }}>
              <div className="stat-info">
                <div className="stat-label">إجمالي تكلفة المشتريات (تُسجل كمصروف)</div>
                <div className="stat-value">{formatCurrency(totalBuy)}</div>
              </div>
            </div>
          </div>

          <div className="form-group mt-24">
            <label className="form-label">ملاحظات الفاتورة والتوريد</label>
            <textarea
              className="form-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="شروط الضمان أو التوريد أو تفاصيل أخرى..."
            />
          </div>
        </div>
      </div>

      <div className="flex gap-12">
        <button className="btn btn-success btn-lg" onClick={handleSave} disabled={saving}>
          <Save size={20} />
          {saving ? 'جاري الحفظ...' : 'حفظ الفاتورة وزيادة المخزون'}
        </button>
        <button className="btn btn-secondary btn-lg" onClick={() => navigate('/spare-parts')}>
          إلغاء
        </button>
      </div>
    </div>
  );
}

export default SparePartsPurchaseInvoice;
