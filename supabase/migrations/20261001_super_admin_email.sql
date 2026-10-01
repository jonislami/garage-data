-- The Super Admin account is jonislami72@gmail.com (keep in sync with src/lib/admin.js
-- and supabase/functions/admin-users/index.ts).
-- Run once in Supabase: Dashboard -> SQL Editor -> paste -> Run.
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) = 'jonislami72@gmail.com' $$;
