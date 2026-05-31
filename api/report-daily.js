import { assertCronAllowed, buildDailyReportMessage, getFinancialReport, sendTelegramText, todayInKsa } from './report-utils.js';

export default async function handler(req, res) {
  if (!assertCronAllowed(req, res)) return;

  try {
    const today = req.query?.date || todayInKsa();
    const report = await getFinancialReport(today, today);
    const message = buildDailyReportMessage(report);
    const result = await sendTelegramText(message);
    return res.status(200).json({ ok: true, result });
  } catch (err) {
    console.error('daily report failed:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
