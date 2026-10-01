import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase URL or Key. Check .env.local");
}

// Invitation and password-reset links arrive as #...&type=invite|recovery. Remember the type
// before the client consumes the link, so the app can ask the user to choose a password.
export const authLinkType = (() => {
  try { return new URLSearchParams(window.location.hash.slice(1)).get('type'); } catch { return null; }
})();

export const supabase = createClient(supabaseUrl, supabaseKey);