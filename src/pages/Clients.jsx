import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, formatCurrency, CITIES, logActivity } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Users, Plus, Upload, Search, Phone, MapPin, DollarSign, X, MessageCircle, Navigation } from 'lucide-react';
import { openGoogleMaps, openWhatsApp } from '../lib/integrations';
import Papa from 'papaparse';

function Clients() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Add client form
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    city: 'mecca',
    contact_person: '',
    notes: ''
  });

  // CSV state
  const [csvData, setCsvData] = useState([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvUploading, setCsvUploading] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients(data || []);
    } catch (err) {
      console.error('خطأ في جلب العملاء:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredClients = clients.filter(client => {
    const matchesSearch = !searchTerm ||
      (client.name && client.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (client.phone && client.phone.includes(searchTerm));

    const matchesCity = cityFilter === 'all' || client.city === cityFilter;

    return matchesSearch && matchesCity;
  });

  function getClientStatus(client) {
    const due = client.total_due || 0;
    if (due === 0) return 'status-good';
    if (due > 0) return 'status-pending';
    return 'status-overdue';
  }

  function handleFormChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function contactClient(event, client) {
    event.stopPropagation();
    openWhatsApp(client.phone, `مرحباً ${client.name}، معكم شركة عاصمة الكون.`);
  }

  function openClientMap(event, client) {
    event.stopPropagation();
    openGoogleMaps(client.address || `${client.name} ${CITIES[client.city] || ''}`);
  }

  function resetForm() {
    setForm({
      name: '',
      phone: '',
      email: '',
      address: '',
      city: 'mecca',
      contact_person: '',
      notes: ''
    });
  }

  async function handleAddClient(e) {
    e.preventDefault();
    if (!form.name || !form.phone) return;

    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('clients')
        .insert({
          name: form.name,
          phone: form.phone,
          email: form.email || null,
          address: form.address || null,
          city: form.city,
          contact_person: form.contact_person || null,
          notes: form.notes || null
        })
        .select()
        .single();

      if (error) throw error;

      await logActivity(
        profile?.id,
        profile?.full_name,
        'إضافة عميل',
        'clients',
        data?.id,
        `تم إضافة العميل: ${form.name}`,
        profile?.branch
      );

      resetForm();
      setShowAddModal(false);
      fetchClients();
    } catch (err) {
      console.error('خطأ في إضافة العميل:', err);
      alert('حدث خطأ أثناء إضافة العميل');
    } finally {
      setSaving(false);
    }
  }

  function handleCsvFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    setCsvFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvData(results.data);
      },
      error: (err) => {
        console.error('خطأ في قراءة الملف:', err);
        alert('حدث خطأ في قراءة ملف CSV');
      }
    });
  }

  async function handleCsvUpload() {
    if (csvData.length === 0) return;

    try {
      setCsvUploading(true);
      const rows = csvData.map(row => ({
        name: row.name || row['الاسم'] || '',
        phone: row.phone || row['الهاتف'] || '',
        email: row.email || row['البريد'] || null,
        address: row.address || row['العنوان'] || null,
        city: row.city || row['المدينة'] || 'mecca',
        contact_person: row.contact_person || row['جهة الاتصال'] || null,
        notes: row.notes || row['ملاحظات'] || null
      })).filter(r => r.name && r.phone);

      if (rows.length === 0) {
        alert('لا توجد بيانات صالحة للاستيراد');
        return;
      }

      const { error } = await supabase.from('clients').insert(rows);
      if (error) throw error;

      await logActivity(
        profile?.id,
        profile?.full_name,
        'استيراد عملاء CSV',
        'clients',
        null,
        `تم استيراد ${rows.length} عميل من ملف CSV`,
        profile?.branch
      );

      setCsvData([]);
      setCsvFileName('');
      setShowCsvModal(false);
      fetchClients();
    } catch (err) {
      console.error('خطأ في استيراد العملاء:', err);
      alert('حدث خطأ أثناء استيراد العملاء');
    } finally {
      setCsvUploading(false);
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
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">
          <span className="title-icon" style={{ background: 'var(--primary-bg)', color: 'var(--primary-light)' }}>
            <Users size={28} />
          </span>
          العملاء
        </h1>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={18} />
            إضافة عميل
          </button>
          <button className="btn btn-secondary" onClick={() => setShowCsvModal(true)}>
            <Upload size={18} />
            استيراد CSV
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="بحث بالاسم أو رقم الهاتف..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <button
            className={`city-filter-btn ${cityFilter === 'all' ? 'active' : ''}`}
            onClick={() => setCityFilter('all')}
          >
            الكل
          </button>
          <button
            className={`city-filter-btn ${cityFilter === 'mecca' ? 'active' : ''}`}
            onClick={() => setCityFilter('mecca')}
          >
            مكة
          </button>
          <button
            className={`city-filter-btn ${cityFilter === 'jeddah' ? 'active' : ''}`}
            onClick={() => setCityFilter('jeddah')}
          >
            جدة
          </button>
        </div>
      </div>

      {/* Clients Grid */}
      {filteredClients.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <Users size={64} />
          </div>
          <h3>لا يوجد عملاء</h3>
          <p>قم بإضافة عميل جديد أو استيراد بيانات العملاء من ملف CSV</p>
        </div>
      ) : (
        <div className="grid-3">
          {filteredClients.map(client => {
            const due = client.total_due || 0;
            const statusClass = getClientStatus(client);
            return (
              <div
                key={client.id}
                className={`client-card ${statusClass}`}
                onClick={() => navigate(`/clients/${client.id}`)}
              >
                <div className="flex-between mb-16">
                  <h3 className="font-bold">{client.name}</h3>
                  <span className={`status-dot ${due === 0 ? 'active' : due > 0 ? 'warning' : 'danger'}`}></span>
                </div>
                <div className="flex gap-8 mb-16">
                  <Phone size={16} className="text-muted" />
                  <span className="text-muted">{client.phone}</span>
                </div>
                <div className="flex-between">
                  <span className={`badge ${client.city === 'mecca' ? 'badge-info' : 'badge-primary'}`}>
                    <MapPin size={12} />
                    {CITIES[client.city] || client.city}
                  </span>
                  <span className={due === 0 ? 'text-success font-semibold' : 'text-danger font-semibold'}>
                    <span className="flex gap-8">
                      <DollarSign size={16} />
                      {formatCurrency(due)}
                    </span>
                  </span>
                </div>
                <div className="quick-actions mt-16">
                  <button
                    className="btn btn-whatsapp btn-sm"
                    onClick={(event) => contactClient(event, client)}
                    disabled={!client.phone}
                    title="إرسال واتساب"
                  >
                    <MessageCircle size={14} />
                    واتساب
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={(event) => openClientMap(event, client)}
                    disabled={!client.address && !client.city}
                    title="فتح الموقع على الخريطة"
                  >
                    <Navigation size={14} />
                    الخريطة
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Client Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">إضافة عميل جديد</h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddClient}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">اسم العميل *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={form.name}
                      onChange={(e) => handleFormChange('name', e.target.value)}
                      placeholder="أدخل اسم العميل"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">رقم الهاتف *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={form.phone}
                      onChange={(e) => handleFormChange('phone', e.target.value)}
                      placeholder="05xxxxxxxx"
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">البريد الإلكتروني</label>
                    <input
                      type="email"
                      className="form-input"
                      value={form.email}
                      onChange={(e) => handleFormChange('email', e.target.value)}
                      placeholder="example@email.com"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">المدينة</label>
                    <select
                      className="form-select"
                      value={form.city}
                      onChange={(e) => handleFormChange('city', e.target.value)}
                    >
                      <option value="mecca">مكة المكرمة</option>
                      <option value="jeddah">جدة</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">العنوان</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.address}
                    onChange={(e) => handleFormChange('address', e.target.value)}
                    placeholder="أدخل العنوان"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">جهة الاتصال</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.contact_person}
                    onChange={(e) => handleFormChange('contact_person', e.target.value)}
                    placeholder="اسم شخص التواصل"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">ملاحظات</label>
                  <textarea
                    className="form-textarea"
                    value={form.notes}
                    onChange={(e) => handleFormChange('notes', e.target.value)}
                    placeholder="أي ملاحظات إضافية..."
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <Plus size={18} />
                  {saving ? 'جاري الحفظ...' : 'إضافة العميل'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Upload Modal */}
      {showCsvModal && (
        <div className="modal-overlay" onClick={() => setShowCsvModal(false)}>
          <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">استيراد العملاء من CSV</h2>
              <button className="modal-close" onClick={() => { setShowCsvModal(false); setCsvData([]); setCsvFileName(''); }}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="file-upload" onClick={() => document.getElementById('csv-input').click()}>
                <div className="upload-icon">
                  <Upload size={40} />
                </div>
                <p>{csvFileName || 'اضغط لاختيار ملف CSV'}</p>
                <p className="upload-hint">الأعمدة المطلوبة: name (الاسم), phone (الهاتف), city (المدينة)</p>
                <input
                  id="csv-input"
                  type="file"
                  accept=".csv"
                  onChange={handleCsvFileChange}
                  hidden
                />
              </div>

              {csvData.length > 0 && (
                <div className="mt-24">
                  <h3 className="font-semibold mb-16">معاينة البيانات ({csvData.length} سجل)</h3>
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>الاسم</th>
                          <th>الهاتف</th>
                          <th>البريد</th>
                          <th>المدينة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvData.slice(0, 10).map((row, idx) => (
                          <tr key={idx}>
                            <td>{idx + 1}</td>
                            <td>{row.name || row['الاسم'] || '-'}</td>
                            <td>{row.phone || row['الهاتف'] || '-'}</td>
                            <td>{row.email || row['البريد'] || '-'}</td>
                            <td>{row.city || row['المدينة'] || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {csvData.length > 10 && (
                    <p className="text-muted text-center mt-16">... و {csvData.length - 10} سجل آخر</p>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-primary"
                onClick={handleCsvUpload}
                disabled={csvData.length === 0 || csvUploading}
              >
                <Upload size={18} />
                {csvUploading ? 'جاري الاستيراد...' : `استيراد ${csvData.length} عميل`}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => { setShowCsvModal(false); setCsvData([]); setCsvFileName(''); }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Clients;
