import { assertCronAllowed, buildMonthlyPdf, getFinancialReport, previousMonthRangeInKsa, sendTelegramDocument } from './report-utils.js';

export default async function handler(req, res) {
  if (!assertCronAllowed(req, res)) return;

  try {
    const range = req.query?.start && req.query?.end
      ? { start: req.query.start, end: req.query.end, label: `${req.query.start}_${req.query.end}` }
      : previousMonthRangeInKsa();
    const report = await getFinancialReport(range.start, range.end);
    const pdf = await buildMonthlyPdf(report, range.label);
    const result = await sendTelegramDocument(
      pdf,
      `capital-universe-monthly-${range.label}.pdf`,
      `التقرير الشهري الكامل - ${range.label}`
    );
    return res.status(200).json({ ok: true, result });
  } catch (err) {
    console.error('monthly report failed:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
