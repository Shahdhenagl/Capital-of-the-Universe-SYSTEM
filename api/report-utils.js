import PDFDocument from 'pdfkit';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://eguiubznbjellqyientv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

export function assertCronAllowed(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.query?.secret !== secret && req.headers['x-cron-secret'] !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 2
  }).format(Number(amount || 0));
}

export function todayInKsa() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
}

export function previousMonthRangeInKsa() {
  const now = new Date();
  const ksaParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit'
  }).formatToParts(now);
  const year = Number(ksaParts.find(part => part.type === 'year').value);
  const month = Number(ksaParts.find(part => part.type === 'month').value);
  const firstOfCurrent = new Date(Date.UTC(year, month - 1, 1));
  const firstOfPrevious = new Date(Date.UTC(firstOfCurrent.getUTCFullYear(), firstOfCurrent.getUTCMonth() - 1, 1));
  const lastOfPrevious = new Date(Date.UTC(firstOfCurrent.getUTCFullYear(), firstOfCurrent.getUTCMonth(), 0));
  return {
    start: firstOfPrevious.toISOString().slice(0, 10),
    end: lastOfPrevious.toISOString().slice(0, 10),
    label: `${firstOfPrevious.getUTCFullYear()}-${String(firstOfPrevious.getUTCMonth() + 1).padStart(2, '0')}`
  };
}

async function supabaseRequest(path) {
  if (!SUPABASE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: 'count=exact'
    }
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

function sum(rows, key = 'amount') {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}

function byBranch(rows, key = 'amount') {
  return rows.reduce((acc, row) => {
    const branch = row.branch || 'unknown';
    acc[branch] = (acc[branch] || 0) + Number(row[key] || 0);
    return acc;
  }, {});
}

export async function getFinancialReport(start, end) {
  const [
    revenues,
    expenses,
    collections,
    salaries,
    advances,
    spareInvoices
  ] = await Promise.all([
    supabaseRequest(`revenues?revenue_date=gte.${start}&revenue_date=lte.${end}&select=*`),
    supabaseRequest(`expenses?expense_date=gte.${start}&expense_date=lte.${end}&select=*`),
    supabaseRequest(`collections?collection_date=gte.${start}&collection_date=lte.${end}&select=*`),
    supabaseRequest(`salaries_payments?payment_date=gte.${start}&payment_date=lte.${end}&select=*`),
    supabaseRequest(`employee_advances?advance_date=gte.${start}&advance_date=lte.${end}&select=*`),
    supabaseRequest(`spare_parts_invoices?created_at=gte.${start}T00:00:00&created_at=lte.${end}T23:59:59&select=*`)
  ]);

  const revenueTotal = sum(revenues);
  const expenseTotal = sum(expenses);
  const collectionTotal = sum(collections);
  const salaryTotal = sum(salaries, 'net_salary');
  const advanceTotal = sum(advances);
  const spareSalesTotal = sum(spareInvoices, 'total_amount');
  const spareProfitTotal = sum(spareInvoices, 'total_profit');

  return {
    start,
    end,
    revenues,
    expenses,
    collections,
    salaries,
    advances,
    spareInvoices,
    totals: {
      revenueTotal,
      expenseTotal,
      collectionTotal,
      salaryTotal,
      advanceTotal,
      spareSalesTotal,
      spareProfitTotal,
      net: revenueTotal - expenseTotal,
      cashIn: revenueTotal + collectionTotal,
      cashOut: expenseTotal + salaryTotal + advanceTotal
    },
    branches: {
      revenues: byBranch(revenues),
      expenses: byBranch(expenses),
      collections: byBranch(collections),
      spareInvoices: byBranch(spareInvoices, 'total_amount')
    }
  };
}

export function buildDailyReportMessage(report) {
  const t = report.totals;
  return [
    `تقرير يومي - ${report.start}`,
    '',
    `الإيرادات المسجلة: ${formatCurrency(t.revenueTotal)} (${report.revenues.length} حركة)`,
    `المصروفات: ${formatCurrency(t.expenseTotal)} (${report.expenses.length} حركة)`,
    `التحصيلات: ${formatCurrency(t.collectionTotal)} (${report.collections.length} حركة)`,
    `الرواتب المصروفة: ${formatCurrency(t.salaryTotal)} (${report.salaries.length} حركة)`,
    `السلف المصروفة: ${formatCurrency(t.advanceTotal)} (${report.advances.length} حركة)`,
    `فواتير قطع الغيار: ${formatCurrency(t.spareSalesTotal)} (${report.spareInvoices.length} فاتورة)`,
    `ربح قطع الغيار: ${formatCurrency(t.spareProfitTotal)}`,
    '',
    `صافي الإيراد المحاسبي: ${formatCurrency(t.net)}`,
    `إجمالي الداخل النقدي: ${formatCurrency(t.cashIn)}`,
    `إجمالي الخارج النقدي: ${formatCurrency(t.cashOut)}`,
    '',
    'تحليل سريع:',
    t.net >= 0 ? 'اليوم رابح محاسبياً.' : 'اليوم فيه عجز محاسبي يحتاج مراجعة المصروفات.',
    t.expenseTotal > t.revenueTotal ? 'المصروفات أعلى من الإيرادات المسجلة اليوم.' : 'الإيرادات تغطي المصروفات المسجلة اليوم.'
  ].join('\n');
}

export function buildMonthlyPdf(report, label) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 44, size: 'A4' });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const t = report.totals;
    doc.fontSize(20).text('Capital Universe - Monthly Financial Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Period: ${label} (${report.start} to ${report.end})`, { align: 'center' });
    doc.moveDown(1.2);

    doc.fontSize(15).text('Executive Summary');
    doc.moveDown(0.4);
    [
      ['Recorded revenue', t.revenueTotal, report.revenues.length],
      ['Expenses', t.expenseTotal, report.expenses.length],
      ['Collections', t.collectionTotal, report.collections.length],
      ['Payroll paid', t.salaryTotal, report.salaries.length],
      ['Employee advances', t.advanceTotal, report.advances.length],
      ['Spare parts sales', t.spareSalesTotal, report.spareInvoices.length],
      ['Spare parts profit', t.spareProfitTotal, report.spareInvoices.length],
      ['Accounting net', t.net, null],
      ['Cash in', t.cashIn, null],
      ['Cash out', t.cashOut, null]
    ].forEach(([labelText, value, count]) => {
      doc.fontSize(11).text(`${labelText}: ${Number(value || 0).toFixed(2)} SAR${count == null ? '' : ` (${count})`}`);
    });

    doc.moveDown(1);
    doc.fontSize(15).text('Branch Breakdown');
    doc.moveDown(0.4);
    ['mecca', 'jeddah'].forEach(branch => {
      doc.fontSize(11).text(`${branch}: revenue ${Number(report.branches.revenues[branch] || 0).toFixed(2)} SAR, expenses ${Number(report.branches.expenses[branch] || 0).toFixed(2)} SAR, collections ${Number(report.branches.collections[branch] || 0).toFixed(2)} SAR, spare sales ${Number(report.branches.spareInvoices[branch] || 0).toFixed(2)} SAR`);
    });

    doc.moveDown(1);
    doc.fontSize(15).text('Analysis');
    doc.fontSize(11).text(t.net >= 0 ? 'The month closed with positive accounting net.' : 'The month closed with negative accounting net.');
    doc.text(t.cashIn >= t.cashOut ? 'Cash inflows covered cash outflows.' : 'Cash outflows exceeded cash inflows; review expense and payroll timing.');
    doc.text(`Spare parts profit contribution: ${Number(t.spareProfitTotal || 0).toFixed(2)} SAR.`);

    doc.moveDown(1);
    doc.fontSize(10).fillColor('#555').text('Generated automatically by Capital Universe SYSTEM.');
    doc.end();
  });
}

export async function sendTelegramText(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error('Missing Telegram environment variables');

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({
      chat_id: chatId,
      text,
      disable_web_page_preview: 'true'
    })
  });

  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function sendTelegramDocument(buffer, filename, caption) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error('Missing Telegram environment variables');

  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('caption', caption);
  formData.append('document', new Blob([buffer], { type: 'application/pdf' }), filename);

  const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) throw new Error(await response.text());
  return response.json();
}
