-- منح صلاحية المدير لحساب Google بعد تسجيل الدخول به مرة واحدة.
-- استخدم البريد الإلكتروني الدقيق للحساب الذي تريد منحه صلاحية الإدارة.
-- هذا الاستعلام لا يفعّل Google OAuth؛ يجب تفعيل Google Provider من Supabase Dashboard.

INSERT INTO public.profiles (id, role)
SELECT u.id, 'admin'
FROM auth.users AS u
WHERE lower(u.email) = lower('mhmdrmdanalhrbawy03@gmail.com')
ON CONFLICT (id)
DO UPDATE SET role = EXCLUDED.role;

-- إذا لم يتأثر أي صف، فتأكد أن الحساب سجّل الدخول مرة واحدة وأن البريد صحيح.
