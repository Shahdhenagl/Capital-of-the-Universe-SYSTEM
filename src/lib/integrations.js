import { supabase, CITIES } from './supabase';

const DEFAULT_COUNTRY_CODE = '966';

function cleanText(value) {
  return String(value || '').trim();
}

export function formatSaudiLocalPhoneInput(value) {
  let digits = cleanText(value).replace(/\D/g, '');
  if (digits.startsWith(DEFAULT_COUNTRY_CODE)) digits = digits.slice(DEFAULT_COUNTRY_CODE.length);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (!digits) return '';
  if (!digits.startsWith('5')) return '';
  return digits.slice(0, 9);
}

export function isValidSaudiLocalPhone(phone) {
  return /^5\d{8}$/.test(cleanText(phone));
}

export function normalizeSaudiPhone(phone) {
  const localPhone = formatSaudiLocalPhoneInput(phone);
  if (localPhone) return `${DEFAULT_COUNTRY_CODE}${localPhone}`;
  const digits = cleanText(phone).replace(/[^\d+]/g, '');
  if (!digits) return '';
  if (digits.startsWith('+')) return digits.slice(1);
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0')) return `${DEFAULT_COUNTRY_CODE}${digits.slice(1)}`;
  if (digits.startsWith(DEFAULT_COUNTRY_CODE)) return digits;
  if (digits.length === 9 && digits.startsWith('5')) return `${DEFAULT_COUNTRY_CODE}${digits}`;
  return digits;
}

export function buildWhatsAppUrl(phone, message = '') {
  const normalized = normalizeSaudiPhone(phone);
  if (!normalized) return '';
  const text = encodeURIComponent(message);
  return `https://wa.me/${normalized}${text ? `?text=${text}` : ''}`;
}

export function openWhatsApp(phone, message) {
  const url = buildWhatsAppUrl(phone, message);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

export function buildGoogleMapsUrl(address) {
  const query = encodeURIComponent(cleanText(address));
  if (!query) return '';
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function openGoogleMaps(address) {
  const url = buildGoogleMapsUrl(address);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function downloadCsv(filename, rows) {
  if (!rows?.length) return false;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.map(csvEscape).join(','),
    ...rows.map(row => headers.map(header => csvEscape(row[header])).join(','))
  ].join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
}

async function postJson(path, payload) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(details || `Request failed: ${response.status}`);
  }

  return response.json().catch(() => ({}));
}

export async function notifyIntegrations(event) {
  const link = event.link?.startsWith('/')
    ? `${window.location.origin}${event.link}`
    : event.link;
  const message = [
    event.title,
    event.message,
    event.actor ? `المستخدم: ${event.actor}` : '',
    event.amount ? `المبلغ: ${event.amount}` : '',
    event.branch ? `الفرع: ${event.branch}` : '',
    ...(event.lines || []),
    link ? `الرابط: ${link}` : ''
  ].filter(Boolean).join('\n');

  const calls = [
    postJson('/api/send-telegram', { text: message }),
    postJson('/api/send-email', {
      subject: event.title,
      text: message,
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8">${message.replace(/\n/g, '<br>')}</div>`
    })
  ];

  if (event.whatsapp) {
    calls.push(postJson('/api/send-whatsapp', { text: message, to: event.whatsappTo }));
  }

  const results = await Promise.allSettled(calls);
  results
    .filter(result => result.status === 'rejected')
    .forEach(result => console.warn('Integration notification skipped:', result.reason?.message || result.reason));
}

export async function notifyTransaction({
  type,
  action = 'تسجيل',
  amount,
  actor,
  branch,
  description,
  date,
  reference,
  category,
  client,
  employee,
  link
}) {
  const lines = [
    category ? `النوع: ${category}` : '',
    client ? `العميل: ${client}` : '',
    employee ? `الموظف: ${employee}` : '',
    date ? `التاريخ: ${date}` : '',
    reference ? `المرجع: ${reference}` : '',
    description ? `الوصف: ${description}` : ''
  ].filter(Boolean);

  await notifyIntegrations({
    title: `معاملة جديدة: ${type}`,
    message: `${action} ${type}`,
    actor,
    amount,
    branch,
    lines,
    link
  });
}

export async function appendGoogleSheet(sheetName, rows) {
  if (!rows?.length) return false;
  await postJson('/api/google-sheets-append', { sheetName, rows });
  return true;
}

export async function uploadDriveTextFile(filename, content, mimeType = 'text/plain') {
  await postJson('/api/google-drive-upload', { filename, content, mimeType });
  return true;
}

export async function checkWeeklyCollections(userId, userName, userBranch) {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    const { data: dueItems, error } = await supabase
      .from('collection_schedule')
      .select('*, clients(name, phone), contracts(contract_number)')
      .eq('status', 'pending')
      .gte('due_date', todayStr)
      .lte('due_date', nextWeekStr);

    if (error) throw error;
    if (!dueItems || dueItems.length === 0) return;

    for (const item of dueItems) {
      const notifTitle = `استحقاق تحصيل قريب`;
      const notifMsg = `العميل ${item.clients?.name || ''} لديه دفعة مستحقة بقيمة ${item.amount} ر.س بتاريخ ${item.due_date}`;

      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('title', notifTitle)
        .like('message', `%${item.clients?.name}%`)
        .limit(1);

      if (!existing || existing.length === 0) {
        await supabase.from('notifications').insert({
          user_id: userId,
          title: notifTitle,
          message: notifMsg,
          type: 'warning',
          link: '/collections'
        });

        await notifyIntegrations({
          title: `🔔 تنبيه استحقاق: ${notifTitle}`,
          message: notifMsg,
          actor: userName,
          amount: `${item.amount} ر.س`,
          branch: CITIES[item.branch] || item.branch,
          lines: [`رقم العقد: ${item.contracts?.contract_number || '-'}`],
          link: '/collections'
        });
      }
    }
  } catch (err) {
    console.error('Error checking weekly collections:', err);
  }
}
