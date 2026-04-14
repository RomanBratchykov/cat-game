import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function getProjectRef(url) {
  try {
    const host = new URL(url).hostname;
    return host.split('.')[0] || 'project';
  } catch {
    return 'project';
  }
}

function getAuthSlot() {
  try {
    return new URLSearchParams(window.location.search).get('auth') || '';
  } catch {
    return '';
  }
}

function getAuthStorageKey() {
  const projectRef = getProjectRef(supabaseUrl);
  const slot = getAuthSlot().trim();
  if (!slot) return `sb-${projectRef}-auth-token`;
  return `sb-${projectRef}-auth-token-${slot}`;
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: getAuthStorageKey(),
      },
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.');
  }
  return supabase;
}
