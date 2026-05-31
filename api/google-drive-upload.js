import { getGoogleAccessToken } from './google-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) {
    return res.status(204).end();
  }

  const { filename, content, mimeType = 'text/plain' } = req.body || {};
  if (!filename || content == null) {
    return res.status(400).json({ error: 'filename and content are required' });
  }

  const token = await getGoogleAccessToken(['https://www.googleapis.com/auth/drive.file']);
  if (!token) {
    return res.status(204).end();
  }

  const boundary = `capital-${Date.now()}`;
  const metadata = {
    name: filename,
    parents: [folderId]
  };
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${mimeType}; charset=UTF-8`,
    '',
    content,
    `--${boundary}--`
  ].join('\r\n');

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body
  });

  if (!response.ok) {
    return res.status(response.status).send(await response.text());
  }

  return res.status(200).json(await response.json());
}
