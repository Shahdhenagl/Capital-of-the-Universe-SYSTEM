export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const defaultTo = process.env.WHATSAPP_TO || process.env.INTEGRATION_WHATSAPP_TO;

  if (!token || !phoneNumberId || !defaultTo) {
    return res.status(204).end();
  }

  const { text, to } = req.body || {};
  if (!text) {
    return res.status(400).json({ error: 'text is required' });
  }

  const recipient = String(to || defaultTo).replace(/[^\d]/g, '');
  if (!recipient) {
    return res.status(400).json({ error: 'recipient is required' });
  }

  const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: recipient,
      type: 'text',
      text: {
        preview_url: false,
        body: text
      }
    })
  });

  if (!response.ok) {
    return res.status(response.status).send(await response.text());
  }

  return res.status(200).json(await response.json());
}
