import 'react-native-url-polyfill/auto';
// RN's AppState collides with @/state/AppState — always alias it.
import { AppState as RNAppState } from 'react-native';

import { SupabaseClient, createClient } from '@supabase/supabase-js';

import { authStorage } from './authStorage';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabaseConfig';

export const isSupabaseConfigured =
  SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

// null until the project credentials are filled in — the app then runs in
// local-only mode (no accounts, no sync) instead of crashing.
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: authStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

// Per Supabase RN guidance: only refresh tokens while the app is foregrounded.
if (supabase != null) {
  const client = supabase;
  client.auth.startAutoRefresh();
  RNAppState.addEventListener('change', status => {
    if (status === 'active') {
      client.auth.startAutoRefresh();
    } else {
      client.auth.stopAutoRefresh();
    }
  });
}
