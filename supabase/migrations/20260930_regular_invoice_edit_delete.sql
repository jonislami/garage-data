-- Controlled editing of regular (fiscal) invoice numbers.
-- Numbers still can't be changed or deleted by a plain update/delete; the two
-- functions below are the only way, and they keep every month's sequence consistent.
-- Run once in Supabase: Dashboard -> SQL Editor -> paste -> Run.

-- Numbering trigger: honour the override flag set by the functions below, and when a
-- numbered invoice's date moves to another month give it the next number there.
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
  elsif current_setting('app.regular_override', true) = 'on' then
    return new;  -- set_regular_invoice_number / delete_regular_invoice
  elsif old.regular_number is not null then
    -- A numbered regular invoice stays regular and keeps its number…
    new.is_regular_invoice := true;
    new.regular_number := old.regular_number;
    new.regular_seq := old.regular_seq;
    new.regular_period := old.regular_period;
    if to_char(coalesce(new.service_date, current_date), 'YYYY-MM') = old.regular_period then
      return new;
    end if;
    -- …unless its date moved to another month: it gets the next number of that month
    new.regular_number := null; new.regular_seq := null; new.regular_period := null;
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

create or replace function public.protect_regular_invoice()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.regular_number is not null and auth.uid() is not null and not public.is_super_admin()
     and coalesce(current_setting('app.regular_override', true), '') <> 'on' then
    raise exception 'Regular invoice % cannot be deleted directly', old.regular_number;
  end if;
  return old;
end $$;

-- NN/MMYYYY from a sequence and a YYYY-MM period
create or replace function public.format_regular_number(p_seq int, p_period text)
returns text language sql immutable set search_path = ''
as $$ select lpad(p_seq::text, 2, '0') || '/' || substr(p_period, 6, 2) || substr(p_period, 1, 4) $$;

-- Change the number of a regular invoice within its month
create or replace function public.set_regular_invoice_number(p_service_id uuid, p_seq int)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  s public.services;
  taken text;
begin
  select * into s from public.services where id = p_service_id;
  if s.id is null or not (s.workshop_id = public.my_workshop_id() or public.is_super_admin()) then
    raise exception 'Invoice not found';
  end if;
  if s.regular_number is null then
    raise exception 'This invoice has no regular number yet';
  end if;
  if p_seq is null or p_seq < 1 or p_seq > 9999 then
    raise exception 'The number must be between 1 and 9999';
  end if;
  if p_seq = s.regular_seq then
    return s.regular_number;
  end if;

  perform pg_advisory_xact_lock(hashtext(s.workshop_id::text || s.regular_period));
  select regular_number into taken from public.services
  where workshop_id = s.workshop_id and regular_period = s.regular_period
    and regular_seq = p_seq and id <> s.id;
  if taken is not null then
    raise exception 'Number % is already used by another invoice', taken;
  end if;

  perform set_config('app.regular_override', 'on', true);
  update public.services
  set regular_seq = p_seq, regular_number = public.format_regular_number(p_seq, s.regular_period)
  where id = s.id;
  perform set_config('app.regular_override', 'off', true);
  return public.format_regular_number(p_seq, s.regular_period);
end $$;

-- Delete a regular invoice; optionally move the later invoices of that month
-- down by one so the sequence has no gap. Returns how many were renumbered.
create or replace function public.delete_regular_invoice(p_service_id uuid, p_close_gap boolean default false)
returns int language plpgsql security definer set search_path = ''
as $$
declare
  s public.services;
  r record;
  moved int := 0;
begin
  select * into s from public.services where id = p_service_id;
  if s.id is null or not (s.workshop_id = public.my_workshop_id() or public.is_super_admin()) then
    raise exception 'Invoice not found';
  end if;

  perform set_config('app.regular_override', 'on', true);
  if s.regular_period is not null then
    perform pg_advisory_xact_lock(hashtext(s.workshop_id::text || s.regular_period));
  end if;
  delete from public.services where id = s.id;

  if p_close_gap and s.regular_seq is not null then
    -- Ascending order: each invoice moves into the slot just freed
    for r in
      select id, regular_seq from public.services
      where workshop_id = s.workshop_id and regular_period = s.regular_period and regular_seq > s.regular_seq
      order by regular_seq
    loop
      update public.services
      set regular_seq = r.regular_seq - 1,
          regular_number = public.format_regular_number(r.regular_seq - 1, s.regular_period)
      where id = r.id;
      moved := moved + 1;
    end loop;
  end if;
  perform set_config('app.regular_override', 'off', true);
  return moved;
end $$;

revoke execute on function public.set_regular_invoice_number(uuid, int) from public, anon;
revoke execute on function public.delete_regular_invoice(uuid, boolean) from public, anon;
grant execute on function public.set_regular_invoice_number(uuid, int) to authenticated;
grant execute on function public.delete_regular_invoice(uuid, boolean) to authenticated;
