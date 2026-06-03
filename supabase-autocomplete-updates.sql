-- ==============================================
-- تحديثات قاعدة البيانات لخاصية الذاكرة الذكية للحقول
-- ==============================================

-- 1. إنشاء جدول الذاكرة
CREATE TABLE IF NOT EXISTS autocomplete_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL,
  value TEXT NOT NULL,
  usage_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category, value)
);

-- 2. إعدادات الأمان RLS
ALTER TABLE autocomplete_memory ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'autocomplete_memory' AND policyname = 'Authenticated users can read autocomplete_memory'
  ) THEN
    CREATE POLICY "Authenticated users can read autocomplete_memory" ON autocomplete_memory FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'autocomplete_memory' AND policyname = 'Authenticated users can insert autocomplete_memory'
  ) THEN
    CREATE POLICY "Authenticated users can insert autocomplete_memory" ON autocomplete_memory FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'autocomplete_memory' AND policyname = 'Authenticated users can update autocomplete_memory'
  ) THEN
    CREATE POLICY "Authenticated users can update autocomplete_memory" ON autocomplete_memory FOR UPDATE USING (auth.uid() IS NOT NULL);
  END IF;
END $$;
