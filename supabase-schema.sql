-- مؤسسة الحرباوي | Supabase schema
-- نفّذ الملف كاملًا من Supabase Dashboard > SQL Editor > New query.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('admin','customer')),
  created_at timestamptz not null default now()
);
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null, category text not null default 'دهانات', description text default '',
  image_url text default '', price numeric(12,2), unit text default 'قطعة', is_active boolean not null default true,
  sort_order int not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(), title text not null, description text default '',
  image_url text default '', starts_at date, ends_at date, is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(), customer_name text not null, phone text not null,
  items jsonb not null default '[]'::jsonb, notes text default '', status text not null default 'new' check (status in ('new','contacted','quoted','completed','cancelled')),
  created_at timestamptz not null default now()
);
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(), customer_name text not null, phone text not null,
  kind text default 'استفسار', message text default '', status text not null default 'new' check (status in ('new','contacted','closed')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.offers enable row level security;
alter table public.orders enable row level security;
alter table public.inquiries enable row level security;

-- الزوار يشاهدون المنتجات والعروض النشطة فقط
drop policy if exists "public read active products" on public.products;
create policy "public read active products" on public.products for select using (is_active=true or public.is_admin());
drop policy if exists "admins manage products" on public.products;
create policy "admins manage products" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "public read active offers" on public.offers;
create policy "public read active offers" on public.offers for select using (is_active=true or public.is_admin());
drop policy if exists "admins manage offers" on public.offers;
create policy "admins manage offers" on public.offers for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- العميل يرسل طلب/استفسار فقط، ولا يستطيع قراءة بيانات العملاء
drop policy if exists "public create orders" on public.orders;
create policy "public create orders" on public.orders for insert to anon, authenticated with check (true);
drop policy if exists "admins manage orders" on public.orders;
create policy "admins manage orders" on public.orders for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "public create inquiries" on public.inquiries;
create policy "public create inquiries" on public.inquiries for insert to anon, authenticated with check (true);
drop policy if exists "admins manage inquiries" on public.inquiries;
create policy "admins manage inquiries" on public.inquiries for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins read profiles" on public.profiles;
create policy "admins read profiles" on public.profiles for select to authenticated using (public.is_admin() or id=auth.uid());
drop policy if exists "admins update profiles" on public.profiles;
create policy "admins update profiles" on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- بيانات أولية للكتالوج (يمكن تعديلها أو حذفها من لوحة الإدارة)
insert into public.products(name,category,description,unit,sort_order) values
('دهانات جوتن','دهانات','حلول دهانات داخلية وخارجية بمستويات تشطيب متنوعة.','عبوة',1),
('دهانات GLC','دهانات','اختيارات متعددة تناسب احتياجات وميزانيات مختلفة.','عبوة',2),
('المعجون وتجهيز الأسطح','دهانات','منتجات تجهيز الحوائط قبل الدهان.','شكارة',3),
('البرايمر والمواد العازلة','دهانات','مواد تأسيس وعزل حسب طبيعة السطح.','عبوة',4),
('الكوالين ومستلزمات الأبواب','حدايد','مستلزمات الأبواب والأقفال.','قطعة',5),
('المفصلات والإكسسوارات','حدايد','إكسسوارات ومستلزمات تركيب متنوعة.','قطعة',6),
('العدد والمسامير','حدايد','عدد يدوية ومستلزمات تثبيت.','قطعة',7),
('مستلزمات الكهرباء','كهرباء','مستلزمات كهربائية متنوعة.','قطعة',8),
('مستلزمات السباكة','سباكة','احتياجات وأدوات السباكة.','قطعة',9),
('أدوات ومستلزمات التشطيب','تشطيب','منتجات مساعدة لأعمال التشطيب.','قطعة',10)
on conflict do nothing;

-- إنشاء حساب الإدارة: أنشئ المستخدم أولًا من Authentication > Users ثم نفّذ:
-- insert into public.profiles(id, role) values ('UUID-USER-FROM-AUTH-USERS','admin')
-- لا تضع service_role key في أي ملف Frontend.
