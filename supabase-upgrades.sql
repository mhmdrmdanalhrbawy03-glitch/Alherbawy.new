

-- الأسئلة الشائعة
create table if not exists public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.faqs enable row level security;
drop policy if exists "public read active faqs" on public.faqs;
create policy "public read active faqs" on public.faqs for select using (is_active = true or public.is_admin());
drop policy if exists "admins manage faqs" on public.faqs;
create policy "admins manage faqs" on public.faqs for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- تخزين صور المنتجات: أنشئ bucket عام لعرض صور المنتجات، مع السماح للمدير فقط بالرفع والتعديل والحذف
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];
drop policy if exists "Public read product images" on storage.objects;
create policy "Public read product images" on storage.objects for select using (bucket_id = 'product-images');
drop policy if exists "Admins upload product images" on storage.objects;
create policy "Admins upload product images" on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.is_admin());
drop policy if exists "Admins update product images" on storage.objects;
create policy "Admins update product images" on storage.objects for update to authenticated using (bucket_id = 'product-images' and public.is_admin()) with check (bucket_id = 'product-images' and public.is_admin());
drop policy if exists "Admins delete product images" on storage.objects;
create policy "Admins delete product images" on storage.objects for delete to authenticated using (bucket_id = 'product-images' and public.is_admin());


-- أسئلة افتراضية تظهر تلقائيًا إذا كان الجدول فارغًا
insert into public.faqs(question,answer,sort_order)
select v.question,v.answer,v.sort_order
from (values
 ('كيف أطلب عرض سعر؟','تصفح المنتجات وأضف احتياجاتك إلى سلة الطلب، أو استخدم نموذج تواصل معنا لتسجيل طلب التسعير داخل الموقع.',1),
 ('هل الأسعار المعروضة نهائية؟','يتم تأكيد السعر والتوافر من فريق المؤسسة حسب النوع والمقاس والكمية قبل اعتماد الطلب.',2),
 ('هل يمكن توريد كميات للمشروعات؟','نعم، أرسل تفاصيل المشروع والكميات المطلوبة من نموذج التواصل وسيتم متابعة طلبك.',3),
 ('أين تقع مؤسسة الحرباوي؟','قرية 1 بنجر — الشارع الرئيسي — بجوار مسجد القرية.',4),
 ('ما مواعيد العمل؟','من 8 صباحًا إلى 10 مساءً، ويوم الجمعة بعد الصلاة.',5)
) as v(question,answer,sort_order)
where not exists (select 1 from public.faqs);
