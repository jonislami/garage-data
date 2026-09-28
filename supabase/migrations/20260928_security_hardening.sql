-- Security hardening: every workshop only sees and changes its own data.
-- Run once in Supabase: Dashboard -> SQL Editor -> paste -> Run.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Keep this email in sync with SUPER_ADMIN_EMAIL in src/App.jsx
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(auth.jwt() ->> 'email', '') = 'trilon1234@gmail.com' $$;

-- The workshop the signed-in user belongs to (security definer avoids RLS recursion)
create or replace function public.my_workshop_id()
returns uuid language sql stable security definer set search_path = ''
as $$ select workshop_id from public.profiles where id = auth.uid() $$;

-- ---------------------------------------------------------------------------
-- profiles: RLS was off, so anyone could set their workshop_id to any workshop
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "Super admin can view profiles" on public.profiles;
create policy "Super admin can view profiles" on public.profiles
  for select to authenticated using (public.is_super_admin());

drop policy if exists "Super admin can update profiles" on public.profiles;
create policy "Super admin can update profiles" on public.profiles
  for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- A user may only attach themselves to a workshop they own (the super admin can assign anyone)
create or replace function public.guard_profile_workshop()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_super_admin() then return new; end if;
  if new.workshop_id is not null
     and (tg_op = 'INSERT' or new.workshop_id is distinct from old.workshop_id)
     and not exists (select 1 from public.workshops w where w.id = new.workshop_id and w.owner_id = auth.uid()) then
    raise exception 'You can only join a workshop you own';
  end if;
  return new;
end $$;

drop trigger if exists guard_profile_workshop on public.profiles;
create trigger guard_profile_workshop before insert or update on public.profiles
  for each row execute function public.guard_profile_workshop();

-- ---------------------------------------------------------------------------
-- workshops: RLS was off and "Workshops Policy" let any signed-in user do anything
-- ---------------------------------------------------------------------------
alter table public.workshops enable row level security;

drop policy if exists "Workshops Policy" on public.workshops;
drop policy if exists "Users can view workshop" on public.workshops;
drop policy if exists "Owners can update their workshop" on public.workshops;
drop policy if exists "Lejo cdo user te krijoje workshop" on public.workshops;
drop policy if exists "Users can create workshop" on public.workshops;

create policy "Workshops select" on public.workshops for select to authenticated
  using (owner_id = auth.uid() or id = public.my_workshop_id() or public.is_super_admin());
create policy "Workshops insert" on public.workshops for insert to authenticated
  with check (owner_id = auth.uid());
create policy "Workshops update" on public.workshops for update to authenticated
  using (owner_id = auth.uid() or id = public.my_workshop_id() or public.is_super_admin())
  with check (owner_id = auth.uid() or id = public.my_workshop_id() or public.is_super_admin());
create policy "Workshops delete" on public.workshops for delete to authenticated
  using (public.is_super_admin());

-- Only the super admin may change subscription status or ownership
create or replace function public.guard_workshop_admin_fields()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_super_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.is_active := true;
    new.trial_ends_at := null;
  elsif new.is_active is distinct from old.is_active
     or new.trial_ends_at is distinct from old.trial_ends_at
     or new.owner_id is distinct from old.owner_id then
    raise exception 'Only the administrator can change subscription status or ownership';
  end if;
  return new;
end $$;

drop trigger if exists guard_workshop_admin_fields on public.workshops;
create trigger guard_workshop_admin_fields before insert or update on public.workshops
  for each row execute function public.guard_workshop_admin_fields();

-- ---------------------------------------------------------------------------
-- service_items: "Service Items Policy" let any signed-in user read/edit every
-- workshop's invoice lines. The workshop-scoped policy stays.
-- ---------------------------------------------------------------------------
drop policy if exists "Service Items Policy" on public.service_items;

-- ---------------------------------------------------------------------------
-- Super admin can read workshop data (Admin portal metrics and backups)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['clients','cars','services','service_items','inventory','expenses'] loop
    execute format('drop policy if exists "Super admin can view %1$s" on public.%1$I', t);
    execute format('create policy "Super admin can view %1$s" on public.%1$I for select to authenticated using (public.is_super_admin())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Sign-up trigger: fixed search_path and not callable through the API
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.guard_profile_workshop() from public, anon, authenticated;
revoke execute on function public.guard_workshop_admin_fields() from public, anon, authenticated;

-- Logo uploads only for signed-in users
alter policy "Users can upload workshop logos" on storage.objects to authenticated;

-- ---------------------------------------------------------------------------
-- Missing column used by the Inspections page (template save/load was failing)
-- ---------------------------------------------------------------------------
alter table public.workshops add column if not exists inspection_template jsonb;

-- Helpers are only needed by signed-in users (inside RLS policies)
revoke execute on function public.is_super_admin() from public, anon;
revoke execute on function public.my_workshop_id() from public, anon;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.my_workshop_id() to authenticated;
