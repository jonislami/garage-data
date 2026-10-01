// The one account that sees the Super Admin centre.
// Also set in public.is_super_admin() (supabase/migrations/20261001_super_admin_email.sql)
// and in supabase/functions/admin-users/index.ts.
export const SUPER_ADMIN_EMAIL = 'jonislami72@gmail.com';

export const isSuperAdminEmail = email => (email || '').toLowerCase() === SUPER_ADMIN_EMAIL;
