# Analytics (PostHog)

Product analytics for DMV Prep. The SDK is `posthog-react-native`; everything
app-side lives in [`src/analytics/`](../src/analytics) and the credentials in
[`src/lib/analyticsConfig.ts`](../src/lib/analyticsConfig.ts).

## Configuration

The project API key and host are filled in already. If the key is ever rotated
(PostHog → Settings → Project → **Project API key**, `phc_…`) or the project
moves to the EU cloud, `src/lib/analyticsConfig.ts` is the only file to touch.

With `POSTHOG_API_KEY` empty the client is never constructed and every
`track()` is a no-op, so a keyless build behaves exactly like a build without
the SDK. The same gate mutes events in dev builds and under jest.

GeoIP enrichment is explicitly disabled in `client.ts`. PostHog receives the
request IP for network delivery but is instructed not to derive city, region,
or other approximate-location properties from it.

Config flags, all in that one file:

| Flag                           | Default | What it does                                     |
| ------------------------------ | ------- | ------------------------------------------------ |
| `ANALYTICS_IN_DEV`             | `false` | Send events from `__DEV__` builds too            |
| `ANALYTICS_CAPTURE_TOUCHES`    | `false` | Autocapture every tap — high volume              |
| `ANALYTICS_SESSION_REPLAY`     | `false` | Screen recording (see below)                     |
| `ANALYTICS_REPLAY_SAMPLE_RATE` | `1`     | Fraction of sessions recorded, when replay is on |

## Reporting an event

```ts
import { track } from '@/analytics';

track('lesson_completed', { lesson_id, correct, question_count, percent });
```

The event name and its properties are typed against `AnalyticsEventMap` in
[`events.ts`](../src/analytics/events.ts) — a typo or a missing property is a
compile error, and that map is the tracking plan. Add the event there first.

For unexpected failures (not handled product states) there is
`trackError(error, context)`, which lands in PostHog error tracking.

## What is collected

Automatic:

- **App lifecycle** — installed, updated, opened, backgrounded
  (`captureAppLifecycleEvents`), plus device, OS, locale and app version from
  `react-native-device-info` / `react-native-localize`.
- **`$screen`** — captured manually from `NavigationContainer.onStateChange`,
  because @react-navigation/native v7 no longer drives the SDK's own screen
  autocapture. The innermost route name plus its primitive params
  (`lesson_id`, `mode`, `category_id`, …). See
  [`screens.ts`](../src/analytics/screens.ts).

Explicit events, by area:

| Area          | Events                                                                                                                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Onboarding    | `onboarding_started`, `onboarding_state_selected`, `onboarding_question_answered`, `onboarding_test_date_selected`, `onboarding_course_built`, `onboarding_reminders_saved`, `onboarding_completed` |
| Notifications | `notification_permission_answered`                                                                                                                                                                  |
| Lessons       | `lesson_opened`, `lesson_checkpoint_answered`, `lesson_recall_revealed`, `lesson_recall_answered`, `lesson_abandoned`, `lesson_completed`                                                            |
| Quizzes       | `quiz_started`, `quiz_question_answered`, `quiz_abandoned`, `quiz_completed`, `question_bookmark_toggled`                                                                                           |
| Signs         | `sign_bookmark_toggled`                                                                                                                                                                             |
| Streak        | `streak_sheet_opened`                                                                                                                                                                               |
| Auth          | `auth_attempted`, `auth_succeeded`, `auth_failed`, `auth_signed_out`, `auth_account_deletion_failed`                                                                                                |
| Monetization  | `paywall_presented`, `paywall_closed`, `purchase_started`, `purchase_completed`, `purchase_failed`, `purchase_restored`, `plus_status_changed`                                                      |
| Settings      | `state_changed`, `font_changed`, `external_link_opened`                                                                                                                                             |

Every event also carries the super properties `us_state` and `plan`, so any
insight can break down by state or by Plus status without joining onto persons.

## Person identity

The distinct id is the **Supabase user id** — the same id the sync engine and
RevenueCat use, so one learner is one person across all three. That includes
the anonymous Supabase user every install gets: they are the majority of
learners, and the pre-signup funnel is what needs measuring. Logging out calls
`posthog.reset()`.

Person properties are refreshed by `AnalyticsIdentity` (mounted next to
`IdentityNameSync` in `App.tsx`) whenever the underlying state changes:
`email`, `name`, `us_state`, `plan`, `signed_in`, `streak_current`,
`streak_longest`, `days_studied`, `lessons_done`, `points`, `best_exam`,
`questions_answered`, `saved_questions`, `mistakes`, `saved_signs`, `font_id`,
`accent_id`.

`email` and `name` are PostHog's own display properties — they are what the
person list and the replay viewer show instead of a bare uuid. Both are null
for anonymous learners, which is most of them.

## Session replay

**Off**, on cost. Mobile recordings are billed per session against a free tier
of 2,500 a month, so replay would have been the whole PostHog bill from around
300 monthly active learners upward — events alone stay free to roughly 3,300,
and then run about a cent per active learner per month.

Everything needed to turn it back on is in place: the
`posthog-react-native-session-replay` native package is installed (inert
without the flag), the masking below is written, and the auth form is wrapped
in a `PostHogMaskView`. Flipping `ANALYTICS_SESSION_REPLAY` is the whole
change — plus the toggle in **PostHog → Settings → Project → Session replay**,
since the client asking for it is only half the switch, and a privacy policy
that names it.

Drop `ANALYTICS_REPLAY_SAMPLE_RATE` to 0.1–0.2 if it does come back on at any
real volume: a fifth of sessions is already more than anyone watches, and it
cuts that bill by the same factor.

Masking, configured in [`client.ts`](../src/analytics/client.ts), for when it
is on:

- **Text inputs are masked.** The auth form is additionally wrapped in a
  `PostHogMaskView`, so email and password never reach a frame even if the
  input-level masking is misconfigured later.
- **Images are not masked.** Every image in the app is a road sign, a course
  diagram or lesson art — the exact thing a replay is watched for. Nothing
  user-supplied is ever rendered as an image (the avatar is a letter in a
  circle). Revisit this the moment that stops being true.
- **Sandboxed system views are masked** (photo/contact pickers). The app does
  not use them today; the default stays on for whatever lands later.

Sample rate is the dial to turn down once there is real traffic — replays are
the expensive part of a PostHog bill.

## Privacy

Events carry ids, counts and enums only: no question text, no free-form input.
Touch autocapture is off, and where it is switched on it captures only
`testID` / `accessibilityLabel` / `ph-label`, never rendered text.

What leaves the device as personal data today: the account **email** and
**display name** on the person profile. (Session replay would add a recording
of what the learner sees — it is off, see above.) These need to be:

1. Named in the privacy policy (draft in `docs/legal/privacy-policy.md`; the
   app links to `permitcoach.app/privacy` in You → About), and
2. Declared in the App Store privacy nutrition labels / Google Play Data
   safety form, and in `PrivacyInfo.xcprivacy` if the collection categories
   change.

## Account deletion

You → Delete account queues deletion of the PostHog person, events and
recordings, and of the RevenueCat customer, so a transient provider outage does
not quietly make in-app deletion partial.

The order in `deleteAccount` ([`AuthProvider.tsx`](../src/auth/AuthProvider.tsx))
is load-bearing:

1. Grab the Supabase access token, **before** the account goes. It stays
   cryptographically valid for the rest of its lifetime once the `auth.users`
   row is deleted, and it is what proves to the server whose person may be
   erased.
2. `delete_account` RPC atomically inserts `account_erasure_jobs` and deletes
   the Supabase user. On failure neither change commits and
   `auth_account_deletion_failed` is reported.
3. Detach the RevenueCat identity so the fresh anonymous Supabase user cannot
   become an alias of the customer queued for deletion.
4. `forgetIdentity()` — flush the queued events (so they are caught by the
   erasure rather than arriving after it), then `reset()`. Anything sent from
   here on lands on a fresh anonymous id and cannot recreate the person.
5. `POST /v1/account/erasure` nudges the queued job immediately. The Railway
   worker also polls independently, calls PostHog's `persons/bulk_delete` with
   `delete_events` **and** `delete_recordings`, and deletes the RevenueCat
   customer through REST API v2. See
   [`server/README.md`](../server/README.md).
6. Clear the session.

The app's nudge is best effort, but the deletion request itself is not: the
queue row was committed before the Supabase user disappeared. Provider
failures are retained with partial-completion timestamps and retried with
backoff. Nothing after deletion is reported to PostHog, since that would
recreate the person.

There is no success event for the same reason; deletions are counted in the
server log instead.
