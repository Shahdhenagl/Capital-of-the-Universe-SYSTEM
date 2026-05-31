export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return res.status(204).end();
  }

  const { text } = req.body || {};
  if (!text) {
    return res.status(400).json({ error: 'text is required' });
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({
      chat_id: chatId,
      text,
      disable_web_page_preview: 'true'
    })
  });

  if (!response.ok) {
    return res.status(response.status).send(await response.text());
  }

  return res.status(200).json(await response.json());
}
