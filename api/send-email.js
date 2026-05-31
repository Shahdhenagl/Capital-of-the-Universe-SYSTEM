export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const to = process.env.INTEGRATION_TO_EMAIL;

  if (!apiKey || !from || !to) {
    return res.status(204).end();
  }

  const { subject, text, html } = req.body || {};
  if (!subject || (!text && !html)) {
    return res.status(400).json({ error: 'subject and text/html are required' });
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      html
    })
  });

  if (!response.ok) {
    return res.status(response.status).send(await response.text());
  }

  return res.status(200).json(await response.json());
}
