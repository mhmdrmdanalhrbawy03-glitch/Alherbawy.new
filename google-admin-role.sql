-- هذا الملف لا يفعّل Google OAuth؛ تفعيل المزود يتم من لوحة Supabase وGoogle Cloud.
-- بعد نجاح تسجيل الدخول بحساب Google مرة واحدة:
-- 1) افتح Supabase > Authentication > Users وانسخ UUID للحساب.
-- 2) استبدل UUID_GOES_HERE بالـ UUID الحقيقي ثم نفّذ الاستعلام:

INSERT INTO public.profiles (id, role)
VALUES ('UUID_GOES_HERE'::uuid, 'admin')
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- لا تضع Client Secret أو service_role key داخل ملفات الموقع أو SQL.
