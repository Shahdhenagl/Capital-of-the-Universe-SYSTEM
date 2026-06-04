-- 1. إضافة حقل أيام الإجازة السنوية للموظفين
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS annual_leave_days integer DEFAULT 0;

-- 2. إضافة حقول خصم الغياب لجدول صرف الرواتب
ALTER TABLE public.salaries_payments 
ADD COLUMN IF NOT EXISTS absence_deduction_days numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS absence_deduction_amount numeric DEFAULT 0;

-- 3. إنشاء جدول الغيابات
CREATE TABLE IF NOT EXISTS public.employee_absences (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
    start_date date NOT NULL,
    end_date date NOT NULL,
    days_count integer NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by uuid REFERENCES auth.users(id)
);

-- 4. إعدادات الأمان (RLS) لجدول الغيابات
ALTER TABLE public.employee_absences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all operations for authenticated users on employee_absences" 
ON public.employee_absences FOR ALL USING (auth.role() = 'authenticated');
