-- ==============================================
-- تحديثات قاعدة البيانات: الموردين والمشتريات لقطع الغيار
-- شغلي السكربت ده في SQL Editor في Supabase لتنفيذ التحديثات
-- ==============================================

-- 1. جدول الموردين (Suppliers)
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  company_name TEXT,
  phone TEXT,
  email TEXT,
  city TEXT NOT NULL CHECK (city IN ('mecca', 'jeddah')),
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. جدول فواتير الشراء (Spare Parts Purchase Invoices)
CREATE TABLE IF NOT EXISTS spare_parts_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_number TEXT NOT NULL UNIQUE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'visa', 'bank_transfer', 'other')),
  status TEXT DEFAULT 'paid' CHECK (status IN ('paid', 'unpaid', 'partial')),
  branch TEXT NOT NULL CHECK (branch IN ('mecca', 'jeddah')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. جدول بنود فاتورة الشراء (Spare Parts Purchase Invoice Items)
CREATE TABLE IF NOT EXISTS spare_parts_purchase_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_id UUID NOT NULL REFERENCES spare_parts_purchases(id) ON DELETE CASCADE,
  spare_part_id UUID NOT NULL REFERENCES spare_parts(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_buy_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- 4. إعدادات RLS (Row Level Security)
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE spare_parts_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE spare_parts_purchase_items ENABLE ROW LEVEL SECURITY;

-- 5. إنشاء سياسات الوصول الأمنية
DO $$ 
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'suppliers', 'spare_parts_purchases', 'spare_parts_purchase_items'
  ])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = 'Authenticated users can read ' || t
    ) THEN
      EXECUTE format('CREATE POLICY "Authenticated users can read %I" ON %I FOR SELECT USING (auth.uid() IS NOT NULL)', t, t);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = 'Authenticated users can insert ' || t
    ) THEN
      EXECUTE format('CREATE POLICY "Authenticated users can insert %I" ON %I FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)', t, t);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = 'Authenticated users can update ' || t
    ) THEN
      EXECUTE format('CREATE POLICY "Authenticated users can update %I" ON %I FOR UPDATE USING (auth.uid() IS NOT NULL)', t, t);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = 'Authenticated users can delete ' || t
    ) THEN
      EXECUTE format('CREATE POLICY "Authenticated users can delete %I" ON %I FOR DELETE USING (auth.uid() IS NOT NULL)', t, t);
    END IF;
  END LOOP;
END $$;

-- 6. إضافة موردين تجريبيين للتسهيل
INSERT INTO suppliers (name, company_name, phone, email, city, address, notes)
VALUES
  ('شركة النور للمصاعد ومستلزماتها', 'النور الكترونيكس', '0540001122', 'info@alnoor.com', 'mecca', 'شارع الستين، مكة المكرمة', 'مورد رئيسي لقطع الغيار الإيطالية وكبائن المصاعد'),
  ('مؤسسة جدة للمحركات والتروس', 'موتورز شوب', '0505556677', 'sales@jeddahmotors.com', 'jeddah', 'طريق المدينة، جدة', 'مورد تروس ومحركات فوجي وياسكاوا')
ON CONFLICT (name) DO NOTHING;
