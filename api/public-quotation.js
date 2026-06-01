const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jlakhsbhjafezyoluvrb.supabase.co';
const FALLBACK_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsYWtoc2JoamFmZXp5b2x1dnJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzA0NjIsImV4cCI6MjA5NTkwNjQ2Mn0.es4mAo3aIy7i3Fr293GwV1cNdn7ATEe4QZOF8avQM80';
const SUPABASE_KEYS = [
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  process.env.SUPABASE_ANON_KEY,
  FALLBACK_ANON_KEY
].filter(Boolean);

function json(res, status, body) {
  res.status(status).json(body);
}

async function supabaseRequest(path, options = {}) {
  if (SUPABASE_KEYS.length === 0) throw new Error('Missing Supabase API key');

  let lastError = '';
  for (const key of SUPABASE_KEYS) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    if (response.ok) {
      if (response.status === 204) return null;
      return response.json();
    }

    lastError = await response.text();
    if (!lastError.includes('Invalid API key')) {
      throw new Error(lastError);
    }
  }

  throw new Error(lastError || 'Invalid Supabase API key');
}

function parseNotes(notes) {
  if (!notes) return {};
  try {
    return JSON.parse(notes);
  } catch {
    return { plainNotes: notes };
  }
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const id = req.query?.id;
      if (!id) return json(res, 400, { error: 'id is required' });

      const rows = await supabaseRequest(
        `quotations?id=eq.${encodeURIComponent(id)}&select=*,clients(name,phone,email,address,city)`
      );
      const quotation = rows?.[0];
      if (!quotation) return json(res, 404, { error: 'Quotation not found' });

      return json(res, 200, { quotation });
    }

    if (req.method === 'POST') {
      const { id, decision, negotiated_amount, notes, customer_name, customer_phone } = req.body || {};
      if (!id || !['accepted', 'rejected', 'negotiation'].includes(decision)) {
        return json(res, 400, { error: 'id and valid decision are required' });
      }

      const rows = await supabaseRequest(`quotations?id=eq.${encodeURIComponent(id)}&select=id,notes,title,amount`);
      const quotation = rows?.[0];
      if (!quotation) return json(res, 404, { error: 'Quotation not found' });

      const existingNotes = parseNotes(quotation.notes);
      const clientResponse = {
        decision,
        negotiated_amount: negotiated_amount || null,
        notes: notes || '',
        customer_name: customer_name || '',
        customer_phone: customer_phone || '',
        responded_at: new Date().toISOString()
      };

      const status = decision === 'accepted' ? 'accepted' : decision === 'rejected' ? 'rejected' : 'pending';
      const rejectionReason = decision === 'rejected'
        ? notes || 'رفض العميل عرض السعر'
        : decision === 'negotiation'
          ? `تفاوض العميل${negotiated_amount ? ` على سعر ${negotiated_amount}` : ''}${notes ? ` - ${notes}` : ''}`
          : null;

      await supabaseRequest(`quotations?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          status,
          rejection_reason: rejectionReason,
          notes: JSON.stringify({
            ...existingNotes,
            client_response: clientResponse
          })
        })
      });

      const decisionLabel = decision === 'accepted' ? 'موافق' : decision === 'rejected' ? 'رافض' : 'تفاوض';
      const users = await supabaseRequest('profiles?is_active=eq.true&select=id');
      if (users?.length) {
        await supabaseRequest('notifications', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify(users.map(user => ({
            user_id: user.id,
            title: 'رد جديد من العميل على عرض السعر',
            message: `العميل رد على العرض "${quotation.title || quotation.id}" بقرار: ${decisionLabel}${negotiated_amount ? ` - السعر المقترح: ${negotiated_amount}` : ''}${notes ? ` - ${notes}` : ''}`,
            type: decision === 'accepted' ? 'success' : decision === 'rejected' ? 'danger' : 'warning',
            link: `/quotations/${id}`
          })))
        });
      }

      return json(res, 200, { ok: true, client_response: clientResponse });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('public quotation api failed:', err);
    return json(res, 500, { error: err.message || 'Server error' });
  }
}
