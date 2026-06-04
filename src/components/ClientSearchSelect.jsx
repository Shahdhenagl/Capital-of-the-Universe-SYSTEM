import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, CITIES } from '../lib/supabase';
import { Search, Plus, User, Phone, MapPin, X, Check, AlertCircle, Building2, ChevronDown } from 'lucide-react';

/**
 * ClientSearchSelect - Smart client search & selection component.
 *
 * Props:
 *   value            – currently selected client_id (string | null)
 *   onSelect         – (client, sites) => void — called when a client is picked / created
 *   onClear          – () => void — called when selection is cleared
 *   clients          – pre-loaded client list (optional, if you already have it)
 *   placeholder      – input placeholder text
 *   required         – HTML required attribute
 *   cityFilter       – optional city filter
 */
export default function ClientSearchSelect({
  value,
  onSelect,
  onClear,
  clients: externalClients,
  placeholder = 'ابحث بالاسم أو رقم الجوال...',
  required = false,
  cityFilter = null
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [allClients, setAllClients] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);

  // New client form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', phone: '', email: '', address: '', city: 'mecca', contact_person: '' });
  const [phoneError, setPhoneError] = useState('');
  const [savingNew, setSavingNew] = useState(false);

  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Load clients
  useEffect(() => {
    if (externalClients?.length) {
      setAllClients(externalClients);
    } else {
      loadClients();
    }
  }, [externalClients]);

  // Resolve selected client on mount / value change
  useEffect(() => {
    if (value && allClients.length) {
      const found = allClients.find(c => c.id === value);
      if (found) {
        setSelectedClient(found);
        setQuery('');
      }
    } else if (!value) {
      setSelectedClient(null);
    }
  }, [value, allClients]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
        setShowNewForm(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function loadClients() {
    try {
      const { data } = await supabase
        .from('clients')
        .select('id, name, phone, email, address, city, contact_person, notes, status')
        .neq('status', 'inactive')
        .order('name');
      setAllClients(data || []);
    } catch (err) {
      console.error('Error loading clients:', err);
    }
  }

  const performSearch = useCallback((searchText) => {
    if (!searchText.trim()) {
      setResults([]);
      return;
    }

    const q = searchText.trim().toLowerCase();
    const isPhoneSearch = /^\d+$/.test(q);

    const filtered = allClients.filter(c => {
      if (c.status === 'inactive') return false;
      if (cityFilter && cityFilter !== 'all' && c.city !== cityFilter) return false;

      if (isPhoneSearch) {
        // Phone search - match anywhere in the phone string
        const phone = (c.phone || '').replace(/\D/g, '');
        return phone.includes(q);
      } else {
        // Name search - split query into words and match each
        const words = q.split(/\s+/);
        const name = (c.name || '').toLowerCase();
        const phone = (c.phone || '').toLowerCase();
        const contactPerson = (c.contact_person || '').toLowerCase();
        return words.every(w =>
          name.includes(w) || phone.includes(w) || contactPerson.includes(w)
        );
      }
    });

    // Sort: exact start match first, then contains
    filtered.sort((a, b) => {
      const aName = (a.name || '').toLowerCase();
      const bName = (b.name || '').toLowerCase();
      const aStarts = aName.startsWith(q) ? 0 : 1;
      const bStarts = bName.startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return aName.localeCompare(bName, 'ar');
    });

    setResults(filtered.slice(0, 10));
  }, [allClients, cityFilter]);

  function handleInputChange(e) {
    const val = e.target.value;
    setQuery(val);
    setIsOpen(true);
    setShowNewForm(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => performSearch(val), 200);
  }

  function handleFocus() {
    if (!selectedClient) {
      setIsOpen(true);
      if (query) performSearch(query);
      else {
        // Show recent/all clients
        const recent = allClients
          .filter(c => c.status !== 'inactive')
          .slice(0, 8);
        setResults(recent);
      }
    }
  }

  async function handleSelectClient(client) {
    setSelectedClient(client);
    setQuery('');
    setIsOpen(false);
    setShowNewForm(false);

    // Load client sites
    try {
      const { data: sites } = await supabase
        .from('client_sites')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });
      onSelect?.(client, sites || []);
    } catch {
      onSelect?.(client, []);
    }
  }

  function handleClear() {
    setSelectedClient(null);
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setShowNewForm(false);
    onClear?.();
  }

  function openNewClientForm() {
    setShowNewForm(true);
    setNewClient({
      name: query || '',
      phone: /^\d+$/.test(query) ? query : '',
      email: '',
      address: '',
      city: cityFilter && cityFilter !== 'all' ? cityFilter : 'mecca',
      contact_person: ''
    });
    setPhoneError('');
  }

  async function checkPhoneUnique(phone) {
    if (!phone || phone.length < 9) {
      setPhoneError('');
      return true;
    }
    const cleaned = phone.replace(/\D/g, '');
    const { data } = await supabase
      .from('clients')
      .select('id, name')
      .eq('phone', cleaned)
      .limit(1);

    if (data?.length > 0) {
      setPhoneError(`هذا الرقم مسجل بالفعل للعميل: ${data[0].name}`);
      return false;
    }
    setPhoneError('');
    return true;
  }

  async function handleSaveNewClient(e) {
    e.preventDefault();
    if (!newClient.name.trim()) return;

    const phone = newClient.phone?.replace(/\D/g, '') || '';
    if (phone) {
      const isUnique = await checkPhoneUnique(phone);
      if (!isUnique) return;
    }

    setSavingNew(true);
    try {
      const payload = {
        name: newClient.name.trim(),
        phone: phone || null,
        email: newClient.email?.trim() || null,
        address: newClient.address?.trim() || null,
        city: newClient.city || 'mecca',
        contact_person: newClient.contact_person?.trim() || null,
        status: 'active'
      };

      const { data, error } = await supabase
        .from('clients')
        .insert(payload)
        .select()
        .single();

      if (error) {
        if (error.message?.includes('unique_client_phone') || error.message?.includes('duplicate')) {
          setPhoneError('هذا الرقم مسجل بالفعل لعميل آخر');
          return;
        }
        throw error;
      }

      // Add to local list
      setAllClients(prev => [data, ...prev]);
      handleSelectClient(data);
    } catch (err) {
      console.error('Error creating client:', err);
      alert('حدث خطأ أثناء إنشاء العميل: ' + (err.message || ''));
    } finally {
      setSavingNew(false);
    }
  }

  function highlightMatch(text, searchQuery) {
    if (!searchQuery || !text) return text;
    const q = searchQuery.toLowerCase();
    const idx = text.toLowerCase().indexOf(q);
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ background: 'var(--primary)', color: '#fff', borderRadius: '2px', padding: '0 2px' }}>
          {text.slice(idx, idx + q.length)}
        </mark>
        {text.slice(idx + q.length)}
      </>
    );
  }

  // Selected state - show chip
  if (selectedClient) {
    return (
      <div className="client-search-selected" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'var(--card-bg)',
        border: '2px solid var(--primary)',
        borderRadius: 'var(--radius-md)',
        padding: '8px 12px',
        minHeight: '44px',
        position: 'relative'
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: 'var(--primary-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <User size={18} style={{ color: 'var(--primary)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text)' }}>
            {selectedClient.name}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {selectedClient.phone && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Phone size={11} /> {selectedClient.phone}
              </span>
            )}
            {selectedClient.city && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <MapPin size={11} /> {CITIES[selectedClient.city] || selectedClient.city}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={handleClear}
          style={{
            background: 'var(--danger-bg)',
            border: 'none',
            borderRadius: '50%',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--danger)',
            flexShrink: 0
          }}
          title="إزالة العميل"
        >
          <X size={14} />
        </button>
        {/* Hidden input for form validation */}
        <input type="hidden" value={selectedClient.id} required={required} />
      </div>
    );
  }

  // Search state
  return (
    <div
      ref={wrapperRef}
      className={`client-search-wrapper ${isOpen ? 'is-open' : ''}`}
      style={{ position: 'relative' }}
    >
      <div style={{ position: 'relative' }}>
        <Search
          size={18}
          style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
            pointerEvents: 'none'
          }}
        />
        <input
          ref={inputRef}
          type="text"
          className="form-input"
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          required={required && !selectedClient}
          autoComplete="off"
          style={{
            paddingRight: '40px',
            paddingLeft: '12px'
          }}
        />
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          left: 0,
          zIndex: 12000,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--primary)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 18px 50px rgba(0,0,0,0.55), 0 0 0 1px rgba(99,102,241,0.25)',
          marginTop: '4px',
          maxHeight: '380px',
          overflowY: 'auto',
          overflowX: 'hidden',
          isolation: 'isolate'
        }}>
          {/* Results list */}
          {!showNewForm && (
            <>
              {results.length > 0 ? (
                <div>
                  {results.map(client => (
                    <div
                      key={client.id}
                      onClick={() => handleSelectClient(client)}
                      style={{
                        padding: '10px 14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        borderBottom: '1px solid var(--border)',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        background: 'var(--primary-bg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <User size={16} style={{ color: 'var(--primary)' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>
                          {highlightMatch(client.name, query)}
                        </div>
                        <div style={{
                          fontSize: '0.78rem',
                          color: 'var(--text-muted)',
                          display: 'flex',
                          gap: '10px',
                          marginTop: '2px'
                        }}>
                          {client.phone && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <Phone size={10} />
                              {highlightMatch(client.phone, query)}
                            </span>
                          )}
                          {client.city && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <MapPin size={10} />
                              {CITIES[client.city] || client.city}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : query.trim() ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  لا توجد نتائج لـ "{query}"
                </div>
              ) : null}

              {/* Add new client button */}
              <div
                onClick={openNewClientForm}
                style={{
                  padding: '12px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  color: 'var(--primary)',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  borderTop: results.length > 0 ? '2px solid var(--border)' : 'none',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  background: 'var(--primary-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Plus size={18} />
                </div>
                إضافة عميل جديد
              </div>
            </>
          )}

          {/* New client form */}
          {showNewForm && (
            <form onSubmit={handleSaveNewClient} style={{ padding: '16px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '14px',
                paddingBottom: '10px',
                borderBottom: '1px solid var(--border)'
              }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text)', fontWeight: 700 }}>
                  <Plus size={16} style={{ marginLeft: '6px', verticalAlign: 'middle' }} />
                  عميل جديد
                </h4>
                <button
                  type="button"
                  onClick={() => setShowNewForm(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    padding: '4px'
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: 'grid', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                    اسم العميل *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={newClient.name}
                    onChange={e => setNewClient(p => ({ ...p, name: e.target.value }))}
                    required
                    autoFocus
                    style={{ fontSize: '0.88rem' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                      رقم الجوال *
                    </label>
                    <input
                      type="tel"
                      className="form-input"
                      value={newClient.phone}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '');
                        setNewClient(p => ({ ...p, phone: val }));
                        setPhoneError('');
                      }}
                      onBlur={() => checkPhoneUnique(newClient.phone)}
                      required
                      maxLength={15}
                      style={{
                        fontSize: '0.88rem',
                        borderColor: phoneError ? 'var(--danger)' : undefined
                      }}
                    />
                    {phoneError && (
                      <div style={{
                        color: 'var(--danger)',
                        fontSize: '0.75rem',
                        marginTop: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <AlertCircle size={12} />
                        {phoneError}
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                      المدينة *
                    </label>
                    <select
                      className="form-select"
                      value={newClient.city}
                      onChange={e => setNewClient(p => ({ ...p, city: e.target.value }))}
                      style={{ fontSize: '0.88rem' }}
                    >
                      {Object.entries(CITIES).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                    العنوان
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={newClient.address}
                    onChange={e => setNewClient(p => ({ ...p, address: e.target.value }))}
                    style={{ fontSize: '0.88rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                    الشخص المسؤول
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={newClient.contact_person}
                    onChange={e => setNewClient(p => ({ ...p, contact_person: e.target.value }))}
                    style={{ fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '14px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowNewForm(false)}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={savingNew || !!phoneError}
                >
                  {savingNew ? (
                    <>جاري الحفظ...</>
                  ) : (
                    <><Check size={14} /> حفظ واختيار</>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
