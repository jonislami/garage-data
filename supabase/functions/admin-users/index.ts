// Super-admin-only user management: invite, assign to a garage, password reset, delete.
// Runs with the service role; every request is checked against the super admin email.
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Keep in sync with src/lib/admin.js and public.is_super_admin()
const SUPER_ADMIN_EMAIL = 'jonislami72@gmail.com';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Who is calling?
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
  const { data: { user } } = await caller.auth.getUser();
  if (!user || (user.email ?? '').toLowerCase() !== SUPER_ADMIN_EMAIL) return json({ error: 'Not allowed' }, 403);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'Invalid request' }, 400); }

  try {
    switch (body.action) {
      case 'invite': {
        const email = String(body.email ?? '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Invalid email' }, 400);
        const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
          redirectTo: typeof body.redirect_to === 'string' ? body.redirect_to : undefined,
        });
        if (error) return json({ error: error.message }, 400);
        const id = data.user.id;
        // The sign-up trigger creates the profile; make sure it exists and link the garage
        const { error: pErr } = await admin.from('profiles')
          .upsert({ id, email, workshop_id: body.workshop_id || null }, { onConflict: 'id' });
        if (pErr) return json({ error: pErr.message }, 400);
        return json({ ok: true, user_id: id });
      }

      case 'assign': {
        const { error } = await admin.from('profiles')
          .upsert({ id: body.user_id, workshop_id: body.workshop_id || null }, { onConflict: 'id' });
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      case 'reset_password': {
        const email = String(body.email ?? '').trim();
        const { error } = await caller.auth.resetPasswordForEmail(email, {
          redirectTo: typeof body.redirect_to === 'string' ? body.redirect_to : undefined,
        });
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      case 'delete': {
        const id = String(body.user_id ?? '');
        if (!id) return json({ error: 'Missing user' }, 400);
        if (id === user.id) return json({ error: 'You cannot delete your own account' }, 400);
        // Garages owned by this user must be moved or deleted first
        const { count } = await admin.from('workshops').select('id', { count: 'exact', head: true }).eq('owner_id', id);
        if (count) return json({ error: 'This user owns a garage. Delete the garage or give it another owner first.' }, 400);
        await admin.from('profiles').delete().eq('id', id);
        const { error } = await admin.auth.admin.deleteUser(id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      default:
        return json({ error: 'Unknown action' }, 400);
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500);
  }
});
