import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eguiubznbjellqyientv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVndWl1YnpuYmplbGxxeWllbnR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MTY1NTgsImV4cCI6MjA5NTE5MjU1OH0.fj9N8SLJuCYpw1CjmE54ARMTXg6GlUQA_72L5s3dN50';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ===== Helper Functions =====

export async function logActivity(userId, userName, action, module, recordId = null, details = null, branch = null) {
  try {
    await supabase.from('activity_log').insert({
      user_id: userId,
      user_name: userName,
      action,
      module,
      record_id: recordId,
      details,
      branch
    });
  } catch (err) {
    console.error('Error logging activity:', err);
  }
}

export async function createNotification(userId, title, message, type = 'info', link = null) {
  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      title,
      message,
      type,
      link
    });
  } catch (err) {
    console.error('Error creating notification:', err);
  }
}

export async function notifyAllAdmins(title, message, type = 'info', link = null) {
  try {
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin');
    
    if (admins) {
      const notifications = admins.map(admin => ({
        user_id: admin.id,
        title,
        message,
        type,
        link
      }));
      await supabase.from('notifications').insert(notifications);
    }
  } catch (err) {
    console.error('Error notifying admins:', err);
  }
}

export function formatCurrency(amount) {
  if (amount == null) return '٠ ر.س';
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 2
  }).format(amount);
}

export function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function formatDateShort(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('ar-SA');
}

export const CITIES = {
  mecca: 'مكة المكرمة',
  jeddah: 'جدة'
};

export const POSITIONS = {
  technician: 'فني',
  admin: 'إداري',
  accountant: 'محاسب',
  manager: 'مدير',
  other: 'أخرى'
};

export const PAYMENT_METHODS = {
  cash: 'كاش',
  visa: 'فيزا',
  bank_transfer: 'تحويل بنكي',
  other: 'أخرى'
};

export const PAYMENT_FREQUENCIES = {
  monthly: 'شهري',
  quarterly: 'ربع سنوي',
  semi_annual: 'نصف سنوي',
  annual: 'سنوي',
  one_time: 'دفعة واحدة'
};

export const QUOTATION_STATUS = {
  pending: 'معلق',
  accepted: 'مقبول',
  rejected: 'مرفوض'
};

export const CONTRACT_STATUS = {
  active: 'نشط',
  completed: 'منتهي',
  cancelled: 'ملغي'
};

export const COLLECTION_STATUS = {
  pending: 'معلق',
  collected: 'محصل',
  overdue: 'متأخر',
  partial: 'جزئي'
};

export const ROLES = {
  admin: 'مدير النظام',
  accountant: 'محاسب',
  viewer: 'مشاهد'
};
