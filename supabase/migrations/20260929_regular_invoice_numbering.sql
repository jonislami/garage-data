-- Separate numbering for regular (fiscal) invoices: NN/MMYYYY, restarting every month
-- per workshop, e.g. 01/012026, 02/012026, then 01/022026.
-- Run once in Supabase: Dashboard -> SQL Editor -> paste -> Run.

alter table public.services
  add column if not exists regular_number text,  -- printed number, e.g. 01/012026
  add column if not exists regular_seq    int,   -- 1, 2, 3… within the month
  add column if not exists regular_period text;  -- YYYY-MM of the invoice date (for sorting)

create unique index if not exists services_regular_number_uniq
  on public.services (workshop_id, regular_period, regular_seq);

create or replace function public.assign_regular_invoice_number()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  d date;
  period text;
  next_seq int;
begin
  if tg_op = 'INSERT' then
    -- New invoices for business clients are regular by default
    if new.is_regular_invoice is null then
      select c.is_business into new.is_regular_invoice
      from public.cars car join public.clients c on c.id = car.client_id
      where car.id = new.car_id;
    end if;
    -- Keep a complete number only when it is supplied (restore from backup)
    if new.regular_number is null or new.regular_seq is null or new.regular_period is null then
      new.regular_number := null; new.regular_seq := null; new.regular_period := null;
    end if;
  elsif old.regular_number is not null then
    -- A numbered regular invoice stays regular and keeps its number
    new.is_regular_invoice := true;
    new.regular_number := old.regular_number;
    new.regular_seq := old.regular_seq;
    new.regular_period := old.regular_period;
    if to_char(coalesce(new.service_date, current_date), 'YYYY-MM') <> old.regular_period then
      raise exception 'Regular invoice % belongs to its month; the date cannot be moved to another month', old.regular_number;
    end if;
    return new;
  else
    new.regular_number := null; new.regular_seq := null; new.regular_period := null;
  end if;

  if coalesce(new.is_regular_invoice, false) and new.regular_number is null then
    d := coalesce(new.service_date, current_date);
    period := to_char(d, 'YYYY-MM');
    -- Serialise numbering per workshop and month so two saves never get the same number
    perform pg_advisory_xact_lock(hashtext(new.workshop_id::text || period));
    select coalesce(max(regular_seq), 0) + 1 into next_seq
    from public.services where workshop_id = new.workshop_id and regular_period = period;
    new.regular_seq := next_seq;
    new.regular_period := period;
    new.regular_number := lpad(next_seq::text, 2, '0') || '/' || to_char(d, 'MMYYYY');
  end if;
  return new;
end $$;

drop trigger if exists assign_regular_invoice_number on public.services;
create trigger assign_regular_invoice_number before insert or update on public.services
  for each row execute function public.assign_regular_invoice_number();

-- Numbered regular invoices cannot be deleted (no gaps in the fiscal sequence).
-- The super admin (e.g. deleting a whole workshop) and the SQL editor are exempt.
create or replace function public.protect_regular_invoice()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.regular_number is not null and auth.uid() is not null and not public.is_super_admin() then
    raise exception 'Regular invoice % cannot be deleted', old.regular_number;
  end if;
  return old;
end $$;

drop trigger if exists protect_regular_invoice on public.services;
create trigger protect_regular_invoice before delete on public.services
  for each row execute function public.protect_regular_invoice();

revoke execute on function public.assign_regular_invoice_number() from public, anon, authenticated;
revoke execute on function public.protect_regular_invoice() from public, anon, authenticated;
