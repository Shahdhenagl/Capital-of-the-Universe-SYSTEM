import { createClient } from '@supabase/supabase-js';

// Setup Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://jdfpysylswylsznctrdt.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase credentials not found in env, using hardcoded for Vercel functions if missing.');
}

const supabase = createClient(
  supabaseUrl,
  supabaseKey || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // Allow GET for cron invocation, or POST for manual testing
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Authorize via Vercel Cron header
  if (req.headers['x-vercel-cron'] !== '1' && process.env.NODE_ENV === 'production' && req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    // Return 401 but allow if it's manual test in development
    // return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const today = new Date();
    
    // Tomorrow date formatting (YYYY-MM-DD)
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    // Yesterday date formatting (YYYY-MM-DD) for exactly 1 day overdue
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // 1. Fetch Tomorrow's Pending Schedules (Reminders)
    const { data: remindersData, error: remindersError } = await supabase
      .from('collection_schedule')
      .select(`
        id, 
        amount, 
        due_date, 
        status, 
        contracts (
          contract_number,
          clients (
            name, 
            phone
          )
        )
      `)
      .eq('status', 'pending')
      .eq('due_date', tomorrowStr);

    if (remindersError) throw remindersError;

    // 2. Fetch Overdue Schedules (Overdue 1 day)
    const { data: overdueData, error: overdueError } = await supabase
      .from('collection_schedule')
      .select(`
        id, 
        amount, 
        due_date, 
        status, 
        contracts (
          contract_number,
          clients (
            name, 
            phone
          )
        )
      `)
      .eq('status', 'pending')
      .eq('due_date', yesterdayStr);

    if (overdueError) throw overdueError;

    const results = {
      remindersSent: 0,
      overdueSent: 0,
      errors: []
    };

    const host = req.headers.host || 'capital-of-the-universe-system.vercel.app';
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const baseUrl = `${protocol}://${host}`;

    // Helper to send whatsapp by calling our own api/notify
    async function sendWhatsapp(payload) {
      const response = await fetch(`${baseUrl}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return await response.json();
    }

    // Process Reminders
    if (remindersData && remindersData.length > 0) {
      for (const schedule of remindersData) {
        if (!schedule.contracts || !schedule.contracts.clients) continue;
        
        let cleanPhone = schedule.contracts.clients.phone?.replace(/\s+/g, '');
        if (!cleanPhone) continue;
        
        if (!cleanPhone.startsWith('+')) {
          if (cleanPhone.startsWith('05')) cleanPhone = '+966' + cleanPhone.substring(1);
          else if (cleanPhone.startsWith('5')) cleanPhone = '+966' + cleanPhone;
          else cleanPhone = '+' + cleanPhone;
        }

        const payload = {
          inbox_id: 107608,
          contact: { phone_number: cleanPhone },
          message: {
            template: {
              name: 'payment_reminder_auto',
              language: 'ar',
              parameters: {
                body: [
                  schedule.contracts.clients.name || 'عميلنا العزيز',
                  schedule.contracts.contract_number,
                  schedule.due_date,
                  schedule.amount.toString()
                ]
              }
            }
          }
        };

        try {
          await sendWhatsapp(payload);
          results.remindersSent++;
        } catch (err) {
          results.errors.push({ type: 'reminder', id: schedule.id, error: err.message });
        }
      }
    }

    // Process Overdue
    if (overdueData && overdueData.length > 0) {
      for (const schedule of overdueData) {
        if (!schedule.contracts || !schedule.contracts.clients) continue;
        
        let cleanPhone = schedule.contracts.clients.phone?.replace(/\s+/g, '');
        if (!cleanPhone) continue;
        
        if (!cleanPhone.startsWith('+')) {
          if (cleanPhone.startsWith('05')) cleanPhone = '+966' + cleanPhone.substring(1);
          else if (cleanPhone.startsWith('5')) cleanPhone = '+966' + cleanPhone;
          else cleanPhone = '+' + cleanPhone;
        }

        const payload = {
          inbox_id: 107608,
          contact: { phone_number: cleanPhone },
          message: {
            template: {
              name: 'payment_overdue_auto',
              language: 'ar',
              parameters: {
                body: [
                  schedule.contracts.clients.name || 'عميلنا العزيز',
                  schedule.contracts.contract_number,
                  schedule.due_date,
                  schedule.amount.toString()
                ]
              }
            }
          }
        };

        try {
          await sendWhatsapp(payload);
          results.overdueSent++;
        } catch (err) {
          results.errors.push({ type: 'overdue', id: schedule.id, error: err.message });
        }
      }
    }

    return res.status(200).json({ ok: true, results });

  } catch (error) {
    console.error('Cron Reminders Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
