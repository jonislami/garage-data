-- Production clean-up before selling to more workshops.
--  * One clear set of RLS policies per table (the old duplicates are removed) using
--    (select …) so auth helpers run once per query instead of once per row.
--  * Rows can only link to the same workshop's rows (car -> client, invoice -> car, …).
--  * New self-signup workshops get a 14-day trial; the super admin activates them.
--  * Indexes for every foreign key; logo uploads limited to images up to 2 MB.
-- Run once in Supabase: Dashboard -> SQL Editor -> paste -> Run. Safe to run again.
-- (Indexes, the 14-day trial and the logo limits were already applied on 2026-10-01;
--  the policy clean-up needs to be run from the SQL Editor.)

-- ---------------------------------------------------------------------------
-- Drop every existing policy on the app tables
-- ---------------------------------------------------------------------------
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in (
      'profiles','workshops','clients','cars','services','service_items','inventory',
      'expenses','inspections','appointments','maintenance_records','maintenance_items')
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "Profiles select" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_super_admin()));
create policy "Profiles insert" on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy "Profiles update" on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.is_super_admin()))
  with check (id = (select auth.uid()) or (select public.is_super_admin()));

-- ---------------------------------------------------------------------------
-- workshops (status/trial/owner changes stay guarded by guard_workshop_admin_fields)
-- ---------------------------------------------------------------------------
create policy "Workshops select" on public.workshops for select to authenticated
  using (owner_id = (select auth.uid()) or id = (select public.my_workshop_id()) or (select public.is_super_admin()));
create policy "Workshops insert" on public.workshops for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "Workshops update" on public.workshops for update to authenticated
  using (owner_id = (select auth.uid()) or id = (select public.my_workshop_id()) or (select public.is_super_admin()))
  with check (owner_id = (select auth.uid()) or id = (select public.my_workshop_id()) or (select public.is_super_admin()));
create policy "Workshops delete" on public.workshops for delete to authenticated
  using ((select public.is_super_admin()));

-- ---------------------------------------------------------------------------
-- Workshop-owned tables: read (own + super admin), write (own only)
-- `link_check` keeps references inside the same workshop.
-- ---------------------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in select * from (values
    ('clients',             'true'),
    ('cars',                'client_id is null or client_id in (select id from public.clients where workshop_id = (select public.my_workshop_id()))'),
    ('services',            'car_id in (select id from public.cars where workshop_id = (select public.my_workshop_id()))'),
    ('inventory',           'true'),
    ('expenses',            'true'),
    ('inspections',         'car_id is null or car_id in (select id from public.cars where workshop_id = (select public.my_workshop_id()))'),
    ('appointments',        '(car_id is null or car_id in (select id from public.cars where workshop_id = (select public.my_workshop_id()))) and (client_id is null or client_id in (select id from public.clients where workshop_id = (select public.my_workshop_id())))'),
    ('maintenance_records', 'car_id in (select id from public.cars where workshop_id = (select public.my_workshop_id()))')
  ) as v(name, link_check)
  loop
    execute format('create policy "Select own" on public.%I for select to authenticated using (workshop_id = (select public.my_workshop_id()) or (select public.is_super_admin()))', t.name);
    execute format('create policy "Insert own" on public.%I for insert to authenticated with check (workshop_id = (select public.my_workshop_id()) and (%s))', t.name, t.link_check);
    execute format('create policy "Update own" on public.%I for update to authenticated using (workshop_id = (select public.my_workshop_id())) with check (workshop_id = (select public.my_workshop_id()) and (%s))', t.name, t.link_check);
    execute format('create policy "Delete own" on public.%I for delete to authenticated using (workshop_id = (select public.my_workshop_id()))', t.name);
  end loop;
end $$;

-- Invoice lines belong to an invoice of the workshop
create policy "Select own" on public.service_items for select to authenticated
  using (service_id in (select id from public.services where workshop_id = (select public.my_workshop_id())) or (select public.is_super_admin()));
create policy "Insert own" on public.service_items for insert to authenticated
  with check (service_id in (select id from public.services where workshop_id = (select public.my_workshop_id())));
create policy "Update own" on public.service_items for update to authenticated
  using (service_id in (select id from public.services where workshop_id = (select public.my_workshop_id())))
  with check (service_id in (select id from public.services where workshop_id = (select public.my_workshop_id())));
create policy "Delete own" on public.service_items for delete to authenticated
  using (service_id in (select id from public.services where workshop_id = (select public.my_workshop_id())));

-- Maintenance items belong to a visit of the workshop (workshop_id is set by trigger)
create policy "Select own" on public.maintenance_items for select to authenticated
  using (workshop_id = (select public.my_workshop_id()) or (select public.is_super_admin()));
create policy "Insert own" on public.maintenance_items for insert to authenticated
  with check (record_id in (select id from public.maintenance_records where workshop_id = (select public.my_workshop_id())));
create policy "Update own" on public.maintenance_items for update to authenticated
  using (workshop_id = (select public.my_workshop_id()))
  with check (record_id in (select id from public.maintenance_records where workshop_id = (select public.my_workshop_id())));
create policy "Delete own" on public.maintenance_items for delete to authenticated
  using (workshop_id = (select public.my_workshop_id()));

-- ---------------------------------------------------------------------------
-- 14-day trial for workshops created by self-signup (super admin is exempt)
-- ---------------------------------------------------------------------------
create or replace function public.guard_workshop_admin_fields()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_super_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.is_active := true;
    new.trial_ends_at := now() + interval '14 days';
  elsif new.is_active is distinct from old.is_active
     or new.trial_ends_at is distinct from old.trial_ends_at
     or new.owner_id is distinct from old.owner_id then
    raise exception 'Only the administrator can change subscription status or ownership';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Indexes for foreign keys / per-workshop lookups
-- ---------------------------------------------------------------------------
create index if not exists appointments_workshop_idx  on public.appointments (workshop_id);
create index if not exists appointments_car_idx       on public.appointments (car_id);
create index if not exists appointments_client_idx    on public.appointments (client_id);
create index if not exists cars_workshop_idx          on public.cars (workshop_id);
create index if not exists cars_client_idx            on public.cars (client_id);
create index if not exists clients_workshop_idx       on public.clients (workshop_id);
create index if not exists expenses_workshop_idx      on public.expenses (workshop_id);
create index if not exists inspections_workshop_idx   on public.inspections (workshop_id);
create index if not exists inspections_car_idx        on public.inspections (car_id);
create index if not exists inventory_workshop_idx     on public.inventory (workshop_id);
create index if not exists maintenance_items_ws_idx   on public.maintenance_items (workshop_id);
create index if not exists maintenance_records_ws_idx on public.maintenance_records (workshop_id);
create index if not exists profiles_workshop_idx      on public.profiles (workshop_id);
create index if not exists service_items_service_idx  on public.service_items (service_id);
create index if not exists services_car_idx           on public.services (car_id);
create index if not exists services_workshop_date_idx on public.services (workshop_id, service_date desc);
create index if not exists workshops_owner_idx        on public.workshops (owner_id);

-- ---------------------------------------------------------------------------
-- Logo uploads: images only, max 2 MB
-- ---------------------------------------------------------------------------
update storage.buckets
set file_size_limit = 2 * 1024 * 1024,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
where id = 'logos';
