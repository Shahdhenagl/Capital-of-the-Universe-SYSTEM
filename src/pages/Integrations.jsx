import { CheckCircle2, ExternalLink, Mail, MapPinned, MessageCircle, Send, ShieldCheck, Table2, UploadCloud } from 'lucide-react';

const integrations = [
  {
    name: 'واتساب',
    icon: MessageCircle,
    status: 'جاهز',
    description: 'أزرار مباشرة للتواصل مع العملاء وتذكير التحصيلات بدون API مدفوع.',
    env: []
  },
  {
    name: 'Google Maps',
    icon: MapPinned,
    status: 'جاهز',
    description: 'فتح مواقع العملاء والمواقع المسجلة مباشرة على خرائط Google بدون مفتاح API.',
    env: []
  },
  {
    name: 'Telegram Alerts',
    icon: Send,
    status: 'يحتاج مفاتيح Vercel',
    description: 'تنبيهات داخلية عند تسجيل تحصيل أو إنشاء فاتورة قطع غيار.',
    env: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']
  },
  {
    name: 'Email via Resend',
    icon: Mail,
    status: 'يحتاج مفاتيح Vercel',
    description: 'إرسال تنبيهات إدارية عبر البريد عند الأحداث المهمة.',
    env: ['RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'INTEGRATION_TO_EMAIL']
  },
  {
    name: 'Google Sheets',
    icon: Table2,
    status: 'يحتاج Service Account',
    description: 'تصدير تقارير التحصيلات إلى Google Sheets من زر Google في صفحة التحصيلات.',
    env: ['GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'GOOGLE_SHEETS_SPREADSHEET_ID']
  },
  {
    name: 'Google Drive',
    icon: UploadCloud,
    status: 'يحتاج Service Account',
    description: 'حفظ نسخة JSON من التقارير المصدرة داخل مجلد Google Drive.',
    env: ['GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'GOOGLE_DRIVE_FOLDER_ID']
  },
  {
    name: 'Sentry',
    icon: ShieldCheck,
    status: import.meta.env.VITE_SENTRY_DSN ? 'مفعل' : 'اختياري',
    description: 'مراقبة أخطاء الواجهة بعد النشر. يتفعل تلقائياً عند إضافة VITE_SENTRY_DSN.',
    env: ['VITE_SENTRY_DSN', 'VITE_SENTRY_TRACES_SAMPLE_RATE']
  }
];

export default function Integrations() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          <span className="title-icon" style={{ background: 'var(--info-bg)', color: 'var(--info-light)' }}>
            <ExternalLink size={28} />
          </span>
          التكاملات
        </h1>
      </div>

      <div className="grid-2">
        {integrations.map(item => {
          const Icon = item.icon;
          return (
            <div className="card" key={item.name}>
              <div className="card-header">
                <h3 className="card-title">
                  <Icon size={20} />
                  {item.name}
                </h3>
                <span className="badge badge-info">
                  <CheckCircle2 size={14} />
                  {item.status}
                </span>
              </div>
              <div className="card-body">
                <p className="text-muted mb-16">{item.description}</p>
                {item.env.length > 0 ? (
                  <div className="integration-env-list">
                    {item.env.map(env => (
                      <code key={env}>{env}</code>
                    ))}
                  </div>
                ) : (
                  <span className="badge badge-success">لا يحتاج مفاتيح</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
