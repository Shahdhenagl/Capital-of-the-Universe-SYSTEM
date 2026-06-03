-- تشغيل هذا الأمر لإلغاء القيد الذي يمنع إضافة أدوار جديدة غير موجودة مسبقاً
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
