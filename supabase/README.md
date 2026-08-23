# Supabase setup

The app talks to Supabase directly (supabase-js + RLS); there is no backend
proxy for auth or data. One-time project setup:

## 1. Create the project

[supabase.com](https://supabase.com) → New project. Then fill in
`src/lib/supabaseConfig.ts` with the **Project URL** and **anon key**
(Project Settings → API). The anon key is public by design — RLS is the
security boundary. Never put the service-role key anywhere in the app.

## 2. Run the migrations

SQL Editor → paste and run, in order:

1. `migrations/0001_init.sql` — tables, RLS, grants, triggers, `sync_push`,
   `sync_pull`, `delete_account`.
2. `migrations/0002_anon_cleanup.sql` — nightly pg_cron job deleting stale
   anonymous users with no progress. (Enable the `pg_cron` extension under
   Database → Extensions if the first line fails.)
3. `migrations/0003_reset_ops.sql` — `reset_ops` in `sync_push`, so a course
   update can invalidate progress the monotonic merge could never lower.
4. `migrations/0004_question_stats_and_streak_history.sql` — the
   `question_stats` table plus `profiles.longest_streak` / `days_studied`,
   and the RPC changes that carry them.
5. `migrations/0005_wipe_progress.sql` — `wipe_progress` in `sync_push`: a
   state switch erases every course-progress row (and best_exam) before the
   payload's own upserts apply, so the new state's course starts clean on
   every device.
6. `migrations/0006_account_erasure_queue.sql` — durable PostHog/RevenueCat
   erasure jobs, a transactional `delete_account`, and a corrected anonymous
   cleanup that also checks `question_stats`, profile progress, inactivity,
   and active Plus status.

Old app builds keep working against a newer database: they simply never send
or read the newer fields. A **new** build against a database still missing
0004 also degrades cleanly — `sync_pull` returns no `question_stats` key, and
the client then keeps its local history instead of reading the absence as a
deletion. Apply 0004 before relying on either being backed up.

## 3. Auth settings (Authentication → …)

- **Sign In / Up → Allow anonymous sign-ins: ON.** Every install gets a real
  user id immediately; registration links an identity to the same id.
- **Sign In / Up → Email → Confirm email: ON.** Registration is two-phase:
  `updateUser({ email, data: { full_name } })` converts the anonymous user in
  place and mails a code, then `verifyOtp({ type: 'email_change' })` proves
  the address and only then does `updateUser({ password })` stick — Supabase
  refuses a password on an unverified address. The app reads the response to
  tell the two configurations apart, so a project with this still **off**
  keeps working: the address lands in one step and the code screen is
  skipped entirely.
- **Email Templates → Change Email Address: must contain `{{ .Token }}`.**
  The conversion is an email *change* (the anonymous user has no address
  yet), so this is the template that goes out — not "Confirm signup". The
  stock copy only offers `{{ .ConfirmationURL }}`, which needs deep links the
  app does not have; the 6-digit `{{ .Token }}` is what the code screen
  expects. Keep `{{ .NewEmail }}` out of it — it renders nothing useful here.
- **Email Templates → Reset Password: must contain `{{ .Token }}` too.**
  "Forgot password?" uses `resetPasswordForEmail` and then
  `verifyOtp({ type: 'recovery' })`, so it needs the same 6-digit code as the
  registration flow rather than a link. Without the variable the email ships
  a `{{ .ConfirmationURL }}` nobody can act on and the reset dead-ends.
- **Email OTP length must stay 6**, matching `CODE_LENGTH` in
  `src/screens/AuthScreen.tsx`. The app cannot read this setting at runtime,
  so the two are coupled by hand: raise it here without editing the constant
  and the code field caps before the learner finishes typing. (New projects
  have shipped with 8.)
- **Secure email change** can stay on: it only double-confirms when there is
  an old address to notify, and an anonymous user has none.
- **Custom SMTP is required before release.** The built-in provider caps
  email project-wide per hour, which the confirmation flow will exhaust the
  moment more than a handful of people register in the same hour; over the
  cap Supabase returns `over_email_send_rate_limit` (HTTP 429) and the code
  never arrives. Point Auth → SMTP Settings at a real sender (Resend,
  Postmark, SendGrid) and raise the rate limit alongside it.
- Rate limits: anonymous sign-ins are ~30/hour/IP — the app degrades
  gracefully (local-only until retry on next foreground). The resend link has
  its own 45s client cooldown, well inside Supabase's per-user window.

## 4. Sign in with Apple (Authentication → Providers → Apple)

- Xcode: add the _Sign in with Apple_ capability to the app target.
- Apple Developer portal: App ID with SIWA enabled.
- In Supabase enter the app's **bundle id** (native id-token flow — no
  Services ID / secret needed for iOS-only).

## 5. Google (Authentication → Providers → Google)

Native id-token flow — no OAuth redirects, no deep links:

- Google Cloud Console → OAuth client ids: one **Web** (its id goes both into
  Supabase provider config and `GOOGLE_WEB_CLIENT_ID` in
  `src/lib/supabaseConfig.ts`) and one **iOS** (`GOOGLE_IOS_CLIENT_ID`; its
  _reversed_ id goes into Info.plist → URL Types).
- Supabase provider config: enable Google, add the Web client id to
  "Authorized Client IDs".

## 6. RevenueCat (subscriptions)

- RevenueCat dashboard: project with an entitlement id `plus`, an offering
  with the subscription package, App Store Connect products connected.
- App-specific **public** SDK keys → `src/lib/revenueCatConfig.ts`
  (`REVENUECAT_APPLE_API_KEY`, `REVENUECAT_GOOGLE_API_KEY`). Until they are
  filled in, the Upgrade button keeps the local dev mock.
- The app identifies to RevenueCat with the Supabase user id
  (`Purchases.logIn`), so purchases follow the anonymous → registered
  transition and across devices automatically.
- Webhook → `profiles.plan` mirror: see `server/README.md` (needs
  `SUPABASE_SERVICE_ROLE_KEY`, `REVENUECAT_WEBHOOK_AUTH` on the server).
- Account erasure also needs Railway's `POSTHOG_*`,
  `REVENUECAT_V2_SECRET_API_KEY`, and `REVENUECAT_PROJECT_ID` variables. Apply
  migration 0006 before deploying the worker-enabled server build.

## How sync works (short version)

- Local state is the source of truth for rendering; the server is a merge
  target. `src/sync/engine.ts` pushes dirty entities (debounced 2.5s, flushed
  on backgrounding) through the `sync_push` RPC and pulls-and-merges via
  `sync_pull` on launch/foreground.
- Merges are monotonic (max points, OR completed, max best scores; set
  deltas), identical in SQL and in `src/sync/merge.ts` — safe under offline
  queues, reinstalls and account switches. Per-question history is monotonic
  too, but as a _unit_: the side with the longer history wins whole, since
  column-wise maxima would pair one device's `correct` with another's `seen`.
- The auth session lives in the iOS Keychain (`src/lib/authStorage.ts`), so
  an anonymous user's progress survives delete + reinstall: the restored
  session pulls it back from the server.
- `profiles.plan` is not client-writable (column-level grant); it is reserved
  for the future RevenueCat webhook (see `server/README.md`).
