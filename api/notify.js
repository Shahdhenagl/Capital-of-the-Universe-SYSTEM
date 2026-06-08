export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body;
    
    const response = await fetch('https://chat.bevatel.com/developer/api/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api_account_id': process.env.VITE_BEVATEL_ACCOUNT_ID || '40728',
        'api_access_token': process.env.VITE_BEVATEL_ACCESS_TOKEN || 'eLDaXuwgQ7LpwzxCA2QkN8e8'
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { error: text };
    }

    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
