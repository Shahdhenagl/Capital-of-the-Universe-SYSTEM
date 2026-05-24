-- ==============================================
-- نظام عاصمة الكون لإدارة شركة المصاعد
-- Supabase Database Schema
-- ==============================================

-- تفعيل UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================
-- 1. جدول الملفات الشخصية (مرتبط بـ auth.users)
-- ==============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'accountant', 'viewer')),
  branch TEXT NOT NULL DEFAULT 'all' CHECK (branch IN ('mecca', 'jeddah', 'all')),
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- 2. جدول العملاء
-- ==============================================
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT NOT NULL CHECK (city IN ('mecca', 'jeddah')),
  contact_person TEXT,
  notes TEXT,
  total_due NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- 3. جدول مواقع العملاء
-- ==============================================
CREATE TABLE client_sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  site_name TEXT NOT NULL,
  address TEXT,
  city TEXT NOT NULL CHECK (city IN ('mecca', 'jeddah')),
  elevator_count INTEGER DEFAULT 1,
  elevator_type TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- 4. جدول أنواع المصروفات
-- ==============================================
CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- بيانات أولية لأنواع المصروفات
INSERT INTO expense_categories (name) VALUES 
  ('رواتب'),
  ('إيجار'),
  ('مواصلات'),
  ('أدوات ومعدات'),
  ('كهرباء ومياه'),
  ('صيانة مكتب'),
  ('تسويق وإعلانات'),
  ('أخرى');

-- ==============================================
-- 5. جدول أنواع الإيرادات
-- ==============================================
CREATE TABLE revenue_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- بيانات أولية لأنواع الإيرادات
INSERT INTO revenue_categories (name) VALUES 
  ('عقود صيانة'),
  ('تركيب مصاعد'),
  ('إصلاح أعطال'),
  ('قطع غيار'),
  ('معاينات'),
  ('مقايسات'),
  ('أخرى');

-- ==============================================
-- 6. جدول المصروفات
-- ==============================================
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES expense_categories(id),
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  branch TEXT NOT NULL CHECK (branch IN ('mecca', 'jeddah')),
  receipt_url TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- 7. جدول الإيرادات
-- ==============================================
CREATE TABLE revenues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES revenue_categories(id),
  client_id UUID REFERENCES clients(id),
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  revenue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  branch TEXT NOT NULL CHECK (branch IN ('mecca', 'jeddah')),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- 8. جدول عروض الأسعار
-- ==============================================
CREATE TABLE quotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_number TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES clients(id),
  service_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  rejection_reason TEXT,
  pdf_url TEXT,
  branch TEXT NOT NULL CHECK (branch IN ('mecca', 'jeddah')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- 9. جدول العقود
-- ==============================================
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_number TEXT NOT NULL UNIQUE,
  quotation_id UUID REFERENCES quotations(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  service_type TEXT NOT NULL,
  title TEXT NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  payment_frequency TEXT NOT NULL CHECK (payment_frequency IN ('monthly', 'quarterly', 'semi_annual', 'annual', 'one_time')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'visa', 'bank_transfer', 'other')),
  installment_amount NUMERIC(12,2),
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  branch TEXT NOT NULL CHECK (branch IN ('mecca', 'jeddah')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- 10. جدول جدول التحصيل
-- ==============================================
CREATE TABLE collection_schedule (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id),
  due_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'collected', 'overdue', 'partial')),
  collected_amount NUMERIC(12,2) DEFAULT 0,
  collected_date DATE,
  payment_method TEXT,
  notes TEXT,
  branch TEXT NOT NULL CHECK (branch IN ('mecca', 'jeddah')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- 11. جدول التحصيلات
-- ==============================================
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID REFERENCES collection_schedule(id),
  contract_id UUID REFERENCES contracts(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  amount NUMERIC(12,2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'visa', 'bank_transfer', 'other')),
  collection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_number TEXT,
  notes TEXT,
  branch TEXT NOT NULL CHECK (branch IN ('mecca', 'jeddah')),
  collected_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- 12. جدول الموظفين
-- ==============================================
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  position TEXT NOT NULL CHECK (position IN ('technician', 'admin', 'accountant', 'manager', 'other')),
  branch TEXT NOT NULL CHECK (branch IN ('mecca', 'jeddah')),
  salary NUMERIC(12,2),
  hire_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- 13. جدول قطع الغيار
-- ==============================================
CREATE TABLE spare_parts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  part_number TEXT,
  buy_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  sell_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity INTEGER DEFAULT 0,
  min_quantity INTEGER DEFAULT 0,
  category TEXT,
  branch TEXT NOT NULL CHECK (branch IN ('mecca', 'jeddah')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- 14. جدول فواتير قطع الغيار
-- ==============================================
CREATE TABLE spare_parts_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES clients(id),
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_profit NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'visa', 'bank_transfer', 'other')),
  status TEXT DEFAULT 'paid' CHECK (status IN ('paid', 'unpaid', 'partial')),
  branch TEXT NOT NULL CHECK (branch IN ('mecca', 'jeddah')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- 15. جدول تفاصيل فاتورة قطع الغيار
-- ==============================================
CREATE TABLE spare_parts_invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES spare_parts_invoices(id) ON DELETE CASCADE,
  spare_part_id UUID NOT NULL REFERENCES spare_parts(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_buy_price NUMERIC(12,2) NOT NULL,
  unit_sell_price NUMERIC(12,2) NOT NULL,
  total_price NUMERIC(12,2) NOT NULL,
  total_cost NUMERIC(12,2) NOT NULL,
  profit NUMERIC(12,2) NOT NULL
);

-- ==============================================
-- 16. جدول الإشعارات
-- ==============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'danger', 'success')),
  is_read BOOLEAN DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- 17. جدول سجل الأنشطة
-- ==============================================
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  user_name TEXT,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  record_id UUID,
  details TEXT,
  branch TEXT CHECK (branch IN ('mecca', 'jeddah')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- 18. جدول الخزنة
-- ==============================================
CREATE TABLE cash_register (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  opening_balance NUMERIC(12,2) DEFAULT 0,
  total_income NUMERIC(12,2) DEFAULT 0,
  total_expense NUMERIC(12,2) DEFAULT 0,
  closing_balance NUMERIC(12,2) DEFAULT 0,
  branch TEXT NOT NULL CHECK (branch IN ('mecca', 'jeddah')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- 19. جدول الخدمات
-- ==============================================
CREATE TABLE services (
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
  ('معاينات');

-- ==============================================
-- إعدادات RLS (Row Level Security)
-- ==============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenues ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE spare_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE spare_parts_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE spare_parts_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_register ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- سياسات الوصول - السماح لجميع المستخدمين المصادق عليهم
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admin can insert profiles" ON profiles FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- سياسة عامة للجداول الأخرى - قراءة وكتابة للمستخدمين المصادق عليهم
DO $$ 
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'clients', 'client_sites', 'expense_categories', 'revenue_categories',
    'expenses', 'revenues', 'quotations', 'contracts', 'collection_schedule',
    'collections', 'employees', 'spare_parts', 'spare_parts_invoices',
    'spare_parts_invoice_items', 'notifications', 'activity_log', 'cash_register', 'services'
  ])
  LOOP
    EXECUTE format('CREATE POLICY "Authenticated users can read %I" ON %I FOR SELECT USING (auth.uid() IS NOT NULL)', t, t);
    EXECUTE format('CREATE POLICY "Authenticated users can insert %I" ON %I FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)', t, t);
    EXECUTE format('CREATE POLICY "Authenticated users can update %I" ON %I FOR UPDATE USING (auth.uid() IS NOT NULL)', t, t);
    EXECUTE format('CREATE POLICY "Authenticated users can delete %I" ON %I FOR DELETE USING (auth.uid() IS NOT NULL)', t, t);
  END LOOP;
END $$;

-- ==============================================
-- دوال مساعدة
-- ==============================================

-- دالة لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- تطبيق الدالة على الجداول التي تحتوي على updated_at
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_quotations_updated_at BEFORE UPDATE ON quotations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_collection_schedule_updated_at BEFORE UPDATE ON collection_schedule FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_spare_parts_updated_at BEFORE UPDATE ON spare_parts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_cash_register_updated_at BEFORE UPDATE ON cash_register FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- دالة لإنشاء ملف شخصي تلقائياً عند التسجيل
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email, role, branch)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'viewer'),
    COALESCE(NEW.raw_user_meta_data->>'branch', 'all')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- دالة لتوليد رقم عرض سعر تلقائياً
CREATE OR REPLACE FUNCTION generate_quotation_number()
RETURNS TEXT AS $$
DECLARE
  seq INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(quotation_number FROM 3) AS INTEGER)), 0) + 1
  INTO seq FROM quotations;
  RETURN 'QT' || LPAD(seq::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- دالة لتوليد رقم عقد تلقائياً
CREATE OR REPLACE FUNCTION generate_contract_number()
RETURNS TEXT AS $$
DECLARE
  seq INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(contract_number FROM 3) AS INTEGER)), 0) + 1
  INTO seq FROM contracts;
  RETURN 'CT' || LPAD(seq::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- دالة لتوليد رقم فاتورة قطع غيار
CREATE OR REPLACE FUNCTION generate_spare_invoice_number()
RETURNS TEXT AS $$
DECLARE
  seq INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 4) AS INTEGER)), 0) + 1
  INTO seq FROM spare_parts_invoices;
  RETURN 'SPI' || LPAD(seq::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;
