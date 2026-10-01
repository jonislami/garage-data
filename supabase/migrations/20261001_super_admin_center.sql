-- Super admin centre: per-garage plan details, payment history and one dashboard call.
-- Run once in Supabase: Dashboard -> SQL Editor -> paste -> Run. Safe to run again.

-- Private plan info per garage (only the super admin can see it; garages can't)
create table if not exists public.workshop_admin (
  workshop_id   uuid primary key references public.workshops(id) on delete cascade,
  monthly_price numeric(10,2),
  notes         text,
  contact_name  text,
  updated_at    timestamptz not null default now()
);

-- Subscription payments; recording one extends the garage's access
create table if not exists public.subscription_payments (
  id          uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  amount      numeric(10,2) not null check (amount >= 0),
  months      integer not null default 1 check (months between 0 and 60),
  paid_at     date not null default current_date,
  method      text,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists subscription_payments_ws_idx on public.subscription_payments (workshop_id, paid_at desc);

alter table public.workshop_admin enable row level security;
alter table public.subscription_payments enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'workshop_admin') then
    create policy "Super admin only" on public.workshop_admin for all to authenticated
      using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'subscription_payments') then
    create policy "Super admin only" on public.subscription_payments for all to authenticated
      using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
  end if;
end $$;

-- Everything the admin centre shows, in one call (super admin only)
create or replace function public.admin_dashboard()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_super_admin() then raise exception 'Not allowed'; end if;
  return jsonb_build_object(
    'workshops', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', w.id, 'name', w.name, 'phone', w.phone, 'address', w.address, 'email', w.email,
        'logo_url', w.logo_url, 'is_active', w.is_active, 'trial_ends_at', w.trial_ends_at,
        'created_at', w.created_at, 'owner_id', w.owner_id,
        'owner_email', (select u.email from auth.users u where u.id = w.owner_id),
        'members', (select count(*) from public.profiles p where p.workshop_id = w.id),
        'clients', (select count(*) from public.clients c where c.workshop_id = w.id),
        'cars', (select count(*) from public.cars c where c.workshop_id = w.id),
        'invoices', (select count(*) from public.services s where s.workshop_id = w.id),
        'invoices_30d', (select count(*) from public.services s where s.workshop_id = w.id and s.created_at > now() - interval '30 days'),
        'last_activity', greatest(
          (select max(s.created_at) from public.services s where s.workshop_id = w.id),
          (select max(u.last_sign_in_at) from auth.users u join public.profiles p on p.id = u.id where p.workshop_id = w.id)),
        'monthly_price', a.monthly_price, 'notes', a.notes, 'contact_name', a.contact_name,
        'paid_total', (select coalesce(sum(sp.amount), 0) from public.subscription_payments sp where sp.workshop_id = w.id),
        'last_payment', (select max(sp.paid_at) from public.subscription_payments sp where sp.workshop_id = w.id)
      ) order by w.created_at desc)
      from public.workshops w left join public.workshop_admin a on a.workshop_id = w.id), '[]'::jsonb),
    'users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', u.id, 'email', u.email, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at,
        'confirmed', u.email_confirmed_at is not null, 'invited_at', u.invited_at,
        'workshop_id', p.workshop_id, 'has_profile', p.id is not null
      ) order by u.created_at desc)
      from auth.users u left join public.profiles p on p.id = u.id), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', sp.id, 'workshop_id', sp.workshop_id, 'amount', sp.amount, 'months', sp.months,
        'paid_at', sp.paid_at, 'method', sp.method, 'note', sp.note
      ) order by sp.paid_at desc, sp.created_at desc)
      from public.subscription_payments sp), '[]'::jsonb)
  );
end $$;

-- Record a payment and extend access by its months (from today, or from the current end date if later)
create or replace function public.admin_record_payment(
  p_workshop_id uuid, p_amount numeric, p_months integer, p_paid_at date default current_date,
  p_method text default null, p_note text default null)
returns timestamptz language plpgsql security definer set search_path = ''
as $$
declare new_end timestamptz;
begin
  if not public.is_super_admin() then raise exception 'Not allowed'; end if;
  insert into public.subscription_payments (workshop_id, amount, months, paid_at, method, note)
  values (p_workshop_id, p_amount, coalesce(p_months, 0), coalesce(p_paid_at, current_date), p_method, p_note);

  if coalesce(p_months, 0) > 0 then
    update public.workshops
    set trial_ends_at = greatest(coalesce(trial_ends_at, now()), now()) + make_interval(months => p_months),
        is_active = true
    where id = p_workshop_id
    returning trial_ends_at into new_end;
  else
    select trial_ends_at into new_end from public.workshops where id = p_workshop_id;
  end if;
  return new_end;
end $$;

revoke execute on function public.admin_dashboard() from public, anon;
revoke execute on function public.admin_record_payment(uuid, numeric, integer, date, text, text) from public, anon;
grant execute on function public.admin_dashboard() to authenticated;
grant execute on function public.admin_record_payment(uuid, numeric, integer, date, text, text) to authenticated;

-- Delete a garage and all its data in one transaction (super admin only)
create or replace function public.admin_delete_workshop(p_workshop_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_super_admin() then raise exception 'Not allowed'; end if;
  -- Children without ON DELETE CASCADE first; the rest cascade with the workshop
  delete from public.services  where workshop_id = p_workshop_id;  -- invoice lines cascade
  delete from public.maintenance_records where workshop_id = p_workshop_id;
  delete from public.inspections where workshop_id = p_workshop_id;
  delete from public.appointments where workshop_id = p_workshop_id;
  delete from public.cars      where workshop_id = p_workshop_id;
  delete from public.clients   where workshop_id = p_workshop_id;
  delete from public.inventory where workshop_id = p_workshop_id;
  update public.profiles set workshop_id = null where workshop_id = p_workshop_id;
  delete from public.workshops where id = p_workshop_id;
end $$;
revoke execute on function public.admin_delete_workshop(uuid) from public, anon;
grant execute on function public.admin_delete_workshop(uuid) to authenticated;
