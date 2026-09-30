-- Turn a numbered regular invoice back into a normal invoice; optionally move the
-- later invoices of that month down by one so the sequence has no gap.
-- Run once in Supabase: Dashboard -> SQL Editor -> paste -> Run.

create or replace function public.unset_regular_invoice(p_service_id uuid, p_close_gap boolean default false)
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
  update public.services
  set is_regular_invoice = false, regular_number = null, regular_seq = null, regular_period = null
  where id = s.id;

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

revoke execute on function public.unset_regular_invoice(uuid, boolean) from public, anon;
grant execute on function public.unset_regular_invoice(uuid, boolean) to authenticated;
