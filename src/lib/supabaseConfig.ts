// Public client credentials. The publishable/anon key is designed to ship in
// the app bundle — row-level security is the actual boundary. NEVER add the
// secret (sb_secret_...) / service-role key here.
//
// Fill these in from the Supabase dashboard (Project Settings → API Keys).
// New projects issue a "publishable key" (sb_publishable_...) — use it as
// the anon key below; legacy anon JWT keys work the same way.
export const SUPABASE_URL = 'https://jowmfpxzygrbomyawhwg.supabase.co';
export const SUPABASE_ANON_KEY =
  'sb_publishable_0OAi8-N5phukepC21y9G2A_0iU1XAAg';

// Google Sign-In (native id-token flow). From Google Cloud Console:
// - Web client id (also entered in Supabase Auth → Providers → Google)
// - iOS client id (its reversed form goes into Info.plist URL schemes)
export const GOOGLE_WEB_CLIENT_ID =
  '302871299276-rjsl226eg1ioibqpdcnm3r4eqa3pt8so.apps.googleusercontent.com';
export const GOOGLE_IOS_CLIENT_ID =
  '302871299276-6uua3trd1majobcvnfoluaicgjt8h15g.apps.googleusercontent.com';
