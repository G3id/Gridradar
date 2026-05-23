-- SchrottRadar Supabase Setup
-- 1) In Supabase SQL Editor ausführen.
-- 2) Danach zwei Admin-User in Supabase Auth manuell anlegen.
-- 3) Deren IDs unten in profiles mit role='super_admin'/'admin' eintragen.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  email text not null,
  name text,
  company text,
  phone text,
  role text not null check (role in ('super_admin','admin','dealer')),
  active boolean not null default true
);

create table if not exists public.scrap_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  customer_name text,
  customer_phone text,
  description text not null,
  lat double precision,
  lng double precision,
  accuracy_m double precision,
  photo_url text,
  status text not null default 'new' check (status in ('new','assigned','accepted','enroute','picked_up','rejected')),
  assigned_dealer_id uuid references public.profiles(id) on delete set null
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  dealer_id uuid not null references public.profiles(id) on delete cascade,
  report_id uuid references public.scrap_reports(id) on delete cascade,
  message text not null,
  seen boolean not null default false
);

alter table public.profiles enable row level security;
alter table public.scrap_reports enable row level security;
alter table public.notifications enable row level security;

create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles p where p.id = uid and p.active and p.role in ('admin','super_admin'));
$$;

create or replace function public.is_super_admin(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles p where p.id = uid and p.active and p.role = 'super_admin');
$$;

create policy "profiles_admin_read" on public.profiles for select using (public.is_admin());
create policy "profiles_self_read" on public.profiles for select using (id = auth.uid());
create policy "profiles_admin_update" on public.profiles for update using (public.is_admin()) with check (public.is_admin());

create policy "public_can_insert_reports" on public.scrap_reports for insert to anon, authenticated with check (true);
create policy "admins_read_all_reports" on public.scrap_reports for select using (public.is_admin());
create policy "admins_update_all_reports" on public.scrap_reports for update using (public.is_admin()) with check (public.is_admin());
create policy "dealer_read_assigned_reports" on public.scrap_reports for select using (assigned_dealer_id = auth.uid());
create policy "dealer_update_own_status" on public.scrap_reports for update using (assigned_dealer_id = auth.uid()) with check (assigned_dealer_id = auth.uid());

create policy "admins_manage_notifications" on public.notifications for all using (public.is_admin()) with check (public.is_admin());
create policy "dealer_read_own_notifications" on public.notifications for select using (dealer_id = auth.uid());
create policy "dealer_update_own_notifications" on public.notifications for update using (dealer_id = auth.uid()) with check (dealer_id = auth.uid());

insert into storage.buckets (id, name, public) values ('scrap-photos','scrap-photos',false)
on conflict (id) do nothing;

create policy "public_upload_scrap_photos" on storage.objects for insert to anon, authenticated
with check (bucket_id = 'scrap-photos' and name like 'reports/%');

create policy "admins_read_scrap_photos" on storage.objects for select using (
  bucket_id = 'scrap-photos' and public.is_admin()
);

create policy "dealers_read_assigned_scrap_photos" on storage.objects for select using (
  bucket_id = 'scrap-photos' and exists (
    select 1 from public.scrap_reports r
    where r.photo_url = storage.objects.name and r.assigned_dealer_id = auth.uid()
  )
);

-- Admin-Bootstrap Beispiel:
-- insert into public.profiles (id,email,name,role)
-- values ('AUTH-USER-ID-ADMIN-1','admin1@example.de','Admin 1','super_admin');
-- insert into public.profiles (id,email,name,role)
-- values ('AUTH-USER-ID-ADMIN-2','admin2@example.de','Admin 2','admin');
