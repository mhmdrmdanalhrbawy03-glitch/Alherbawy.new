-- تحديث متجر مؤسسة الحرباوي - نسخة مصححة وقابلة لإعادة التشغيل
create extension if not exists pgcrypto;

alter table public.orders add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.orders add column if not exists total_amount numeric(12,2) not null default 0;
alter table public.orders add column if not exists payment_method_id uuid;
alter table public.orders add column if not exists payment_method_name text;
alter table public.orders add column if not exists payment_reference text;
alter table public.orders add column if not exists receipt_path text;
alter table public.orders add column if not exists tracking_code text default ('HB-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)));
alter table public.orders add column if not exists updated_at timestamptz not null default now();
alter table public.orders add column if not exists admin_note text default '';
alter table public.orders add column if not exists payment_status text not null default 'pending_review';
update public.orders set tracking_code='HB-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)) where tracking_code is null or tracking_code='';
alter table public.orders alter column tracking_code set default ('HB-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)));
alter table public.orders alter column tracking_code set not null;

-- حالات الطلب تشمل كل الحالات التي تستخدمها صفحة العميل ولوحة الإدارة.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in ('new','contacted','quoted','completed','cancelled','pending_review','payment_confirmed','payment_rejected','processing','shipped','delivered','rejected'));
alter table public.orders alter column status set default 'pending_review';

create table if not exists public.payment_methods (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 account_name text default '',
 account_number text not null,
 instructions text default '',
 is_active boolean not null default true,
 sort_order int not null default 0,
 created_at timestamptz not null default now()
);
alter table public.payment_methods enable row level security;
drop policy if exists "active payment methods public read" on public.payment_methods;
create policy "active payment methods public read" on public.payment_methods for select to anon, authenticated using (is_active=true or public.is_admin());
drop policy if exists "admins manage payment methods" on public.payment_methods;
create policy "admins manage payment methods" on public.payment_methods for all to authenticated using(public.is_admin()) with check(public.is_admin());

alter table public.orders enable row level security;
drop policy if exists "public create orders" on public.orders;
drop policy if exists "admins manage orders" on public.orders;
drop policy if exists "customers read own orders" on public.orders;
drop policy if exists "customers create own orders" on public.orders;
drop policy if exists "admins manage all orders" on public.orders;
drop policy if exists "customers attach receipt while pending" on public.orders;
create policy "customers read own orders" on public.orders for select to authenticated using (user_id=auth.uid() or public.is_admin());
create policy "customers create own orders" on public.orders for insert to authenticated with check (
 user_id=auth.uid()
 and status='pending_review'
 and payment_status='pending_review'
 and payment_method_id is not null
 and exists(select 1 from public.payment_methods pm where pm.id=payment_method_id and pm.is_active=true)
);
create policy "admins manage all orders" on public.orders for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "customers attach receipt while pending" on public.orders for update to authenticated
using (user_id=auth.uid() and status='pending_review' and payment_status='pending_review')
with check (user_id=auth.uid() and status='pending_review' and payment_status='pending_review');

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('payment-receipts','payment-receipts',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp','application/pdf'];
drop policy if exists "customer upload own payment receipt" on storage.objects;
create policy "customer upload own payment receipt" on storage.objects for insert to authenticated with check(bucket_id='payment-receipts' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "customer read own payment receipt" on storage.objects;
create policy "customer read own payment receipt" on storage.objects for select to authenticated using(bucket_id='payment-receipts' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin()));
drop policy if exists "admin manage payment receipts" on storage.objects;
create policy "admin manage payment receipts" on storage.objects for all to authenticated using(bucket_id='payment-receipts' and public.is_admin()) with check(bucket_id='payment-receipts' and public.is_admin());

-- إنشاء profile تلقائيًا للمستخدمين الجدد حتى لا يتعطل إنشاء الطلب بعد التسجيل.
create or replace function public.handle_new_user_profile()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.profiles(id,role) values(new.id,'customer') on conflict(id) do nothing;
 return new;
end;
$$;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users
for each row execute function public.handle_new_user_profile();
