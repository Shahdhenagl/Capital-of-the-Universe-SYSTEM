-- ==============================================
-- تحديثات قاعدة بيانات موجودة
-- شغلي الملف ده بدل supabase-schema.sql لو الجداول موجودة بالفعل
-- ==============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================
-- Storage Bucket للمرفقات وملفات PDF
-- ==============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true,
  52428800,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public can read documents'
  ) THEN
    CREATE POLICY "Public can read documents"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can upload documents'
  ) THEN
    CREATE POLICY "Authenticated users can upload documents"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can update documents'
  ) THEN
    CREATE POLICY "Authenticated users can update documents"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = 'documents')
      WITH CHECK (bucket_id = 'documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can delete documents'
  ) THEN
    CREATE POLICY "Authenticated users can delete documents"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'documents');
  END IF;
END $$;

-- ==============================================
-- أعمدة جديدة على جداول موجودة
-- ==============================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;

ALTER TABLE client_sites ADD COLUMN IF NOT EXISTS floor_count INTEGER DEFAULT 0;
ALTER TABLE client_sites ADD COLUMN IF NOT EXISTS responsible_name TEXT;
ALTER TABLE client_sites ADD COLUMN IF NOT EXISTS responsible_phone TEXT;
ALTER TABLE client_sites ADD COLUMN IF NOT EXISTS elevator_codes JSONB DEFAULT '[]'::jsonb;

ALTER TABLE collection_schedule ALTER COLUMN contract_id DROP NOT NULL;

-- ==============================================
-- جدول الخدمات وربطه بعروض الأسعار
-- ==============================================
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO services (name) VALUES
  ('تركيب مصاعد'),
  ('صيانة دورية'),
  ('دعم الأعطال'),
  ('مقايسات'),
  ('قطع غيار'),
  ('معاينات')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE quotations ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id);

-- ==============================================
-- تحديث حالات عروض الأسعار لتطابق Workflow الحالي في التطبيق
-- ==============================================
ALTER TABLE quotations DROP CONSTRAINT IF EXISTS quotations_status_check;

ALTER TABLE quotations ADD CONSTRAINT quotations_status_check
  CHECK (status IN (
    'draft',
    'pending',
    'accepted',
    'rejected',
    'pending_manager',
    'manager_approved',
    'manager_rejected',
    'sent',
    'client_negotiating',
    'client_accepted',
    'client_rejected',
    'final_approved',
    'final_rejected'
  ));

ALTER TABLE quotations ALTER COLUMN status SET DEFAULT 'pending_manager';

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'services' AND policyname = 'Authenticated users can read services'
  ) THEN
    CREATE POLICY "Authenticated users can read services" ON services
      FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'services' AND policyname = 'Authenticated users can insert services'
  ) THEN
    CREATE POLICY "Authenticated users can insert services" ON services
      FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'services' AND policyname = 'Authenticated users can update services'
  ) THEN
    CREATE POLICY "Authenticated users can update services" ON services
      FOR UPDATE USING (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'services' AND policyname = 'Authenticated users can delete services'
  ) THEN
    CREATE POLICY "Authenticated users can delete services" ON services
      FOR DELETE USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- ==============================================
-- تأكيد البريد الإلكتروني تلقائياً للمستخدمين الجدد والحاليين
-- ==============================================

-- 1. تأكيد البريد الإلكتروني لجميع المستخدمين الحاليين في النظام الذين لم يتم تأكيدهم
UPDATE auth.users 
SET email_confirmed_at = NOW() 
WHERE email_confirmed_at IS NULL;

-- 2. دالة وتريجر لتأكيد البريد الإلكتروني تلقائياً لأي مستخدم جديد يتم إضافته مستقبلاً
CREATE OR REPLACE FUNCTION public.confirm_email_automatically()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email_confirmed_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- حذف التريجر إذا كان موجوداً مسبقاً لمنع التكرار
DROP TRIGGER IF EXISTS on_auth_user_before_created ON auth.users;

-- إنشاء التريجر قبل عملية الإدخال لتعديل الحقول مباشرة
CREATE TRIGGER on_auth_user_before_created
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.confirm_email_automatically();
