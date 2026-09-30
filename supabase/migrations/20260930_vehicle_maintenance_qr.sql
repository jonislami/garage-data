-- Vehicle maintenance history with per-item intervals, and a permanent QR code per vehicle.
-- Run once in Supabase: Dashboard -> SQL Editor -> paste -> Run.

-- ---------------------------------------------------------------------------
-- Permanent, unguessable QR token per vehicle (the sticker is printed once)
-- ---------------------------------------------------------------------------
alter table public.cars
  add column if not exists qr_token uuid not null default gen_random_uuid();
create unique index if not exists cars_qr_token_key on public.cars (qr_token);

-- ---------------------------------------------------------------------------
-- One row per visit (mileage + date), many changed items per visit
-- ---------------------------------------------------------------------------
create table if not exists public.maintenance_records (
  id           uuid primary key default gen_random_uuid(),
  workshop_id  uuid not null references public.workshops(id) on delete cascade,
  car_id       uuid not null references public.cars(id) on delete cascade,
  mileage      integer not null check (mileage >= 0),
  service_date date not null default current_date,
  notes        text,
  created_at   timestamptz not null default now()
);
create index if not exists maintenance_records_car_idx
  on public.maintenance_records (car_id, service_date desc, mileage desc);

create table if not exists public.maintenance_items (
  id              uuid primary key default gen_random_uuid(),
  record_id       uuid not null references public.maintenance_records(id) on delete cascade,
  workshop_id     uuid not null references public.workshops(id) on delete cascade,
  item_key        text not null,            -- 'engine_oil', 'oil_filter', … or 'custom:<name>'
  item_name       text not null,
  brand           text,
  spec            text,                     -- oil type / viscosity, part spec…
  quantity        text,
  interval_km     integer check (interval_km is null or interval_km > 0),
  interval_months integer check (interval_months is null or interval_months > 0),
  due_km          integer,                  -- calculated: record mileage + interval_km
  due_date        date,                     -- calculated: record date + interval_months
  created_at      timestamptz not null default now()
);
create index if not exists maintenance_items_record_idx on public.maintenance_items (record_id);

-- Due mileage/date are always calculated by the database from the visit
create or replace function public.calc_maintenance_item_due()
returns trigger language plpgsql set search_path = ''
as $$
declare r public.maintenance_records;
begin
  select * into r from public.maintenance_records where id = new.record_id;
  new.workshop_id := r.workshop_id;
  new.due_km := case when new.interval_km is null then null else r.mileage + new.interval_km end;
  new.due_date := case when new.interval_months is null then null
                       else (r.service_date + make_interval(months => new.interval_months))::date end;
  return new;
end $$;

drop trigger if exists calc_maintenance_item_due on public.maintenance_items;
create trigger calc_maintenance_item_due before insert or update on public.maintenance_items
  for each row execute function public.calc_maintenance_item_due();

-- If a visit's mileage or date is corrected, recalculate its items
create or replace function public.recalc_maintenance_record_items()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.mileage is distinct from old.mileage or new.service_date is distinct from old.service_date then
    update public.maintenance_items set interval_km = interval_km where record_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists recalc_maintenance_record_items on public.maintenance_records;
create trigger recalc_maintenance_record_items after update on public.maintenance_records
  for each row execute function public.recalc_maintenance_record_items();

-- ---------------------------------------------------------------------------
-- Access: each workshop only its own data; super admin can read
-- ---------------------------------------------------------------------------
alter table public.maintenance_records enable row level security;
alter table public.maintenance_items enable row level security;

drop policy if exists "Maintenance records" on public.maintenance_records;
create policy "Maintenance records" on public.maintenance_records for all to authenticated
  using (workshop_id = public.my_workshop_id() or public.is_super_admin())
  with check (workshop_id = public.my_workshop_id()
              and car_id in (select id from public.cars where workshop_id = public.my_workshop_id()));

drop policy if exists "Maintenance items" on public.maintenance_items;
create policy "Maintenance items" on public.maintenance_items for all to authenticated
  using (workshop_id = public.my_workshop_id() or public.is_super_admin())
  with check (record_id in (select id from public.maintenance_records where workshop_id = public.my_workshop_id()));

-- ---------------------------------------------------------------------------
-- Public QR page: read-only data for one vehicle by its token.
-- Returns no customer name/phone; only the vehicle, the garage and the history.
-- ---------------------------------------------------------------------------
create or replace function public.get_vehicle_maintenance(p_token uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'vehicle', jsonb_build_object('make', c.make, 'model', c.model, 'year', c.year, 'plate', c.plate, 'engine', c.engine),
    'workshop', jsonb_build_object('name', w.name, 'phone', w.phone, 'address', w.address,
                                   'logo_url', w.logo_url, 'email', w.email, 'website', w.website),
    'records', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'service_date', r.service_date, 'mileage', r.mileage, 'notes', r.notes,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'item_key', i.item_key, 'item_name', i.item_name, 'brand', i.brand, 'spec', i.spec,
            'quantity', i.quantity, 'interval_km', i.interval_km, 'interval_months', i.interval_months,
            'due_km', i.due_km, 'due_date', i.due_date) order by i.created_at)
          from public.maintenance_items i where i.record_id = r.id), '[]'::jsonb)
      ) order by r.service_date desc, r.mileage desc, r.created_at desc)
      from public.maintenance_records r where r.car_id = c.id), '[]'::jsonb)
  )
  from public.cars c join public.workshops w on w.id = c.workshop_id
  where c.qr_token = p_token
$$;

revoke execute on function public.get_vehicle_maintenance(uuid) from public;
grant execute on function public.get_vehicle_maintenance(uuid) to anon, authenticated;
revoke execute on function public.calc_maintenance_item_due() from public, anon, authenticated;
revoke execute on function public.recalc_maintenance_record_items() from public, anon, authenticated;
