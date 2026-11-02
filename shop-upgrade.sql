-- متجر مؤسسة الحرباوي: نفّذ هذا الملف مرة واحدة من Supabase > SQL Editor
create extension if not exists pgcrypto;

alter table public.orders add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.orders add column if not exists total_amount numeric(12,2) not null default 0;
alter table public.orders add column if not exists payment_method_id uuid;
alter table public.orders add column if not exists payment_method_name text;
alter table public.orders add column if not exists payment_reference text;
alter table public.orders add column if not exists receipt_path text;
alter table public.orders add column if not exists tracking_code text not null default ('HB-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)));
alter table public.orders add column if not exists updated_at timestamptz not null default now();
alter table public.orders add column if not exists admin_note text default '';
alter table public.orders add column if not exists payment_status text not null default 'pending_review';

-- استبدال قيد الحالة القديم بقيم المتجر الجديدة
DO $block$
DECLARE
  constraint_row record;
BEGIN
  FOR constraint_row IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.orders'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I', constraint_row.conname);
  END LOOP;
END
$block$;
alter table public.orders alter column status set default 'pending_review';

create table if not exists public.payment_methods (
 id uuid primary key default gen_random_uuid(), name text not null,
 account_name text default '', account_number text not null,
 instructions text default '', is_active boolean not null default true,
 sort_order int not null default 0, created_at timestamptz not null default now()
);
alter table public.payment_methods enable row level security;
drop policy if exists "active payment methods public read" on public.payment_methods;
create policy "active payment methods public read" on public.payment_methods for select using (is_active=true or public.is_admin());
drop policy if exists "admins manage payment methods" on public.payment_methods;
create policy "admins manage payment methods" on public.payment_methods for all to authenticated using(public.is_admin()) with check(public.is_admin());

alter table public.orders enable row level security;
drop policy if exists "public create orders" on public.orders;
drop policy if exists "admins manage orders" on public.orders;
drop policy if exists "customers read own orders" on public.orders;
drop policy if exists "customers create own orders" on public.orders;
drop policy if exists "admins manage all orders" on public.orders;
create policy "customers read own orders" on public.orders for select to authenticated using (user_id=auth.uid() or public.is_admin());
create policy "customers create own orders" on public.orders for insert to authenticated with check (user_id=auth.uid());
create policy "admins manage all orders" on public.orders for all to authenticated using(public.is_admin()) with check(public.is_admin());

-- تخزين إثباتات الدفع في bucket خاص؛ لا تُجعل الصور عامة
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('payment-receipts','payment-receipts',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp','application/pdf'];
drop policy if exists "customer upload own payment receipt" on storage.objects;
create policy "customer upload own payment receipt" on storage.objects for insert to authenticated with check(bucket_id='payment-receipts' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "customer read own payment receipt" on storage.objects;
create policy "customer read own payment receipt" on storage.objects for select to authenticated using(bucket_id='payment-receipts' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin()));
drop policy if exists "admin manage payment receipts" on storage.objects;
create policy "admin manage payment receipts" on storage.objects for all to authenticated using(bucket_id='payment-receipts' and public.is_admin()) with check(bucket_id='payment-receipts' and public.is_admin());

-- إتاحة قراءة بيانات الحساب الشخصية للعميل نفسه موجودة بالفعل في سياسة profiles.

-- لا يقبل النظام طلب متجر جديد بدون وسيلة دفع وإثبات تحويل، ويبدأ دائمًا قيد المراجعة.
alter table public.orders drop constraint if exists orders_checkout_required;
alter table public.orders add constraint orders_checkout_required
 check (payment_method_id is not null) not valid;
drop policy if exists "customers create own orders" on public.orders;
create policy "customers create own orders" on public.orders for insert to authenticated
with check (
 user_id=auth.uid() and payment_method_id is not null
 and status='pending_review' and payment_status='pending_review'
 and exists(select 1 from public.payment_methods pm where pm.id=payment_method_id and pm.is_active=true)
);

-- يسمح للعميل بإرفاق الإثبات لاحقًا ما دام الطلب لم يُعتمد بعد.
drop policy if exists "customers attach receipt while pending" on public.orders;
create policy "customers attach receipt while pending" on public.orders for update to authenticated
using (user_id=auth.uid() and status='pending_review' and payment_status='pending_review')
with check (user_id=auth.uid() and status='pending_review' and payment_status='pending_review');
