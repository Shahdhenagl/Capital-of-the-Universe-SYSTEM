import { getGoogleAccessToken } from './google-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    return res.status(204).end();
  }

  const { sheetName = 'Exports', rows } = req.body || {};
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'rows are required' });
  }

  const token = await getGoogleAccessToken(['https://www.googleapis.com/auth/spreadsheets']);
  if (!token) {
    return res.status(204).end();
  }

  const headers = Object.keys(rows[0]);
  const values = [headers, ...rows.map(row => headers.map(header => row[header] ?? ''))];
  const range = encodeURIComponent(`${sheetName}!A1`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values })
  });

  if (!response.ok) {
    return res.status(response.status).send(await response.text());
  }

  return res.status(200).json(await response.json());
}
