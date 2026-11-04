-- ترقية حسابات العملاء وإدارة دليل العملاء لمؤسسة الحرباوي
-- دالة تحقق آمنة يستخدمها RLS لمعرفة المدير دون كشف بيانات profiles للعملاء.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'); $$;

-- شغّل هذا الملف مرة واحدة في Supabase SQL Editor بعد ترقية المتجر الأساسية.
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists created_at timestamptz not null default now();

create or replace function public.sync_customer_profile()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, role, email, full_name, phone)
  values (new.id, 'customer', new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name',''), coalesce(new.raw_user_meta_data->>'phone',''))
  on conflict (id) do update set
    email = excluded.email,
    full_name = case when excluded.full_name <> '' then excluded.full_name else public.profiles.full_name end,
    phone = case when excluded.phone <> '' then excluded.phone else public.profiles.phone end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_profile_sync on auth.users;
create trigger on_auth_user_profile_sync after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.sync_customer_profile();

insert into public.profiles(id, role, email, full_name, phone)
select u.id, coalesce(p.role,'customer'), u.email, coalesce(u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name',''), coalesce(u.raw_user_meta_data->>'phone','')
from auth.users u left join public.profiles p on p.id=u.id
on conflict (id) do update set email=excluded.email, full_name=case when excluded.full_name<>'' then excluded.full_name else public.profiles.full_name end, phone=case when excluded.phone<>'' then excluded.phone else public.profiles.phone end;

alter table public.profiles enable row level security;
drop policy if exists "customers read own profile" on public.profiles;
drop policy if exists "admins read all customer profiles" on public.profiles;
create policy "customers read own profile" on public.profiles for select to authenticated using (id=auth.uid());
create policy "admins read all customer profiles" on public.profiles for select to authenticated using (public.is_admin());
