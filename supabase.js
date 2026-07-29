/* ============================================================
   The Knife Codex — Supabase integration
   Creates the Supabase client and exposes a small helper API on
   window.SB for auth, cloud-synced progress, and the leaderboard.

   The anon / publishable key below is meant to be public — it only
   grants the access allowed by your Row Level Security policies (see
   supabase-schema.sql). NEVER put the service_role key in this file.
   ============================================================ */
(function () {
  'use strict';

  const SUPABASE_URL = 'https://qqsbxxfbloecawptmmvm.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_nEOz4X-VMhY4j4ZyIYuQkg_Hx7GDU8F';

  // The CDN UMD bundle exposes the library as window.supabase.
  if (!window.supabase || !window.supabase.createClient) {
    console.error('[SB] Supabase library did not load — cloud features disabled.');
    window.SB = { ready: false };
    return;
  }

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  // The redirect target for magic links / email confirmations (no hash).
  const redirectTo = window.location.href.split('#')[0];

  window.SB = {
    ready: true,
    client,

    /* ---------- Auth ---------- */
    async getSession() {
      const { data } = await client.auth.getSession();
      return data.session;
    },
    onAuthChange(cb) {
      client.auth.onAuthStateChange((_event, session) => cb(session));
    },
    signUpPassword(email, password, displayName) {
      return client.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName || '' }, emailRedirectTo: redirectTo }
      });
    },
    signInPassword(email, password) {
      return client.auth.signInWithPassword({ email, password });
    },
    signInMagic(email, displayName) {
      return client.auth.signInWithOtp({
        email,
        options: { data: { display_name: displayName || '' }, emailRedirectTo: redirectTo }
      });
    },
    signInOAuth(provider) {
      // provider: 'google' | 'discord'. Redirects the browser to the provider
      // and back to redirectTo, where detectSessionInUrl completes sign-in.
      return client.auth.signInWithOAuth({
        provider,
        options: { redirectTo }
      });
    },
    updateDisplayName(displayName) {
      return client.auth.updateUser({ data: { display_name: displayName } });
    },
    signOut() {
      return client.auth.signOut();
    },

    /* ---------- Progress (private per-user JSON blob) ---------- */
    async fetchProgress(userId) {
      const { data, error } = await client
        .from('progress').select('data').eq('user_id', userId).maybeSingle();
      if (error) { console.warn('[SB] fetchProgress', error.message); return null; }
      return data ? data.data : null;
    },
    saveProgress(userId, data) {
      return client.from('progress').upsert(
        { user_id: userId, data, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    },

    /* ---------- Profile (public leaderboard row) ---------- */
    upsertProfile(userId, fields) {
      return client.from('profiles').upsert(
        { id: userId, ...fields, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      );
    },
    async fetchProfile(userId) {
      const { data } = await client
        .from('profiles').select('*').eq('id', userId).maybeSingle();
      return data || null;
    },
    async fetchLeaderboard(limit = 25) {
      const { data, error } = await client
        .from('profiles')
        .select('display_name, xp, knives_found, knives_owned')
        .order('xp', { ascending: false })
        .order('knives_found', { ascending: false })
        .limit(limit);
      if (error) { console.warn('[SB] fetchLeaderboard', error.message); return []; }
      return data || [];
    },
    async searchProfiles(query, limit = 12) {
      const q = (query || '').trim().replace(/[%_\\]/g, m => '\\' + m);
      if (!q) return [];
      const { data, error } = await client
        .from('profiles')
        .select('display_name, xp, knives_found, knives_owned, updated_at')
        .ilike('display_name', `%${q}%`)
        .order('xp', { ascending: false })
        .limit(limit);
      if (error) { console.warn('[SB] searchProfiles', error.message); return []; }
      return data || [];
    }
  };
})();
