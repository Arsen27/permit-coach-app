# Course delivery and updates: what can go wrong, and what the device is left with

The model makes no offline promise. At start the app downloads the course
**outline** (modules, lesson titles, objectives, question ids, and a
`{sha256, sizeBytes}` reference per lesson) and the course's **question
bank**; a lesson's body is downloaded the first time that lesson is opened
and kept on the device for good, addressed by its hash. Pictures are fetched
in the background once their lesson's body arrives. The rule under
everything: **what the device holds is never half-replaced** — a sync that
dies leaves the outline, bank, cached bodies and marks exactly as they were,
and the next check simply tries again. The server can steer any device from
any state; nothing here needs an app-store release to fix.

Verified 2026-08-31 by `__tests__/lazyStore.test.ts` (sync, sweeps, yellow
marks), `__tests__/stateSwitch.test.tsx`, `__tests__/learnScreen.test.tsx`,
the server's `verdict.test.ts` / `verdictRoute.test.ts`, and — against the
live production server — `LIVE_SERVER=1 npx jest __tests__/liveCourse.test.ts`.

## The check

`SyncManager` runs one throttled check (15 minutes) on mount and on every
foreground: `GET /v2/bootstrap` returns, in one answer, the **verdict** for
the held course version, the production sha of the question bank, and the
sha of the signs catalogue. The verdict is computed server-side from the
release taxonomy (`update_kind`, `update_subtype`, `replaces`,
`changed_lessons`, `update_message` on `course_releases`); the app never
diffs version numbers itself.

| Verdict                                                                   | What the device does                                                                                                                                                        | Progress             |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| nothing                                                                   | nothing                                                                                                                                                                     | untouched            |
| `replace` (a **fix**: patch releases on the held lineage, chained)        | swaps the outline, sweeps cached lesson bodies whose hash the new outline no longer names, refreshes the bank if its sha moved                                              | untouched            |
| `replace`, subtype `silent`                                               | that, and nobody is told anything                                                                                                                                           | untouched            |
| `replace`, subtype `apology` / `rules`                                    | that, plus one modal ("We fixed a mistake" / "The rules changed") — and the changed lessons the learner had completed turn **yellow** until retaken                         | untouched            |
| `offer` (a **course** update released as `offer`)                         | a modal offering the new course with an explicit warning that progress is lost; declining is remembered; accepting wipes the course's keys and installs the offered version | wiped only on accept |
| a **course** update released as `new_users`                               | nothing — existing devices are never told; fresh installs start on it                                                                                                       | untouched            |
| device's version unknown to the channel (fresh install, rollback past it) | takes the channel's version wholesale, silently                                                                                                                             | untouched            |
| `appUpdateRequired`                                                       | the offer/replace above the raise is withheld; fixes under it still land                                                                                                    | untouched            |

Yellow marks are block-precise: when a replace arrives, the old block hashes
of each changed-and-completed lesson are stashed; when that lesson's new
body is downloaded the mark narrows to the blocks whose hashes actually
differ, and completing the lesson clears it. A lesson the learner never
completed is never marked and never mentioned.

The question bank and the signs catalogue have no versions and no ceremony:
a moved sha is taken wholesale, for everyone, on the next check (bank) or
the next visit to the signs screens (signs). Rolling either back is
publishing an older sha.

## Failures, by where they strike

| Where                                                            | Device is left with                                                                                                                        | Then                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `/v2/bootstrap` unreachable / times out (10 s, retried)          | everything as it was; no modal                                                                                                             | next foreground                                 |
| verdict says replace, outline fetch dies mid-way                 | the old outline, bank and bodies — the swap is written only after the new outline validates                                                | next check                                      |
| a new outline fails validation (server bug)                      | as it was; the malformed outline is refused whole, never partially adopted                                                                 | fixed on the server                             |
| bank fetch dies or fails validation                              | the old bank                                                                                                                               | next check                                      |
| a lesson body fetch dies (30 s, retried)                         | the lesson screen shows a spinner, then the standard iOS alert — "No Connection", Cancel / Try Again, once per failure                     | retry, or walk back; the next visit tries again |
| a lesson body disagrees with the outline's `{sha256, sizeBytes}` | refused; reads as the same alert                                                                                                           | fixed on the server                             |
| a picture fails to download                                      | the lesson still opens; that picture shows its placeholder                                                                                 | fetched again next time its lesson is ensured   |
| killed mid-sync                                                  | whatever step completed is whole; nothing is half-written                                                                                  | next foreground                                 |
| the learner accepts an offer and the install then dies           | the course keys are already wiped; lesson screens show the connection alert until the next successful check reinstalls the offered version | next foreground / retry                         |
| the server rolls the channel back mid-anything                   | the device is simply above the channel on its next check and takes the channel's version wholesale                                         | —                                               |
| a state switch                                                   | each course keeps its own keys under `dmv-prep/lazy/v1/…`; the other course's cache is untouched                                           | switching back re-syncs                         |
| the check throws for a reason nobody foresaw                     | treated as a failed run; the app carries on what it holds                                                                                  | next foreground                                 |

## What the learner sees

- Nothing at all for the usual "already current" answer, and nothing ever
  for a silent fix or a new-users-only course release.
- On a fix with an apology or a rules note: one modal, and completed lessons
  whose content changed glow yellow on the ladder (and the changed blocks
  are tinted inside the lesson) until retaken.
- On an offer: one modal with the explicit progress-loss warning; "Not now"
  is remembered.
- Opening a never-downloaded lesson with no connection: the standard alert
  with Try Again; a downloaded lesson opens instantly, connection or not.
- Onboarding downloads only the outline and the bank (`installCourse`), so
  the first screen arrives in seconds; bodies come as lessons are opened.

## The list of states

`GET /v1/courses` names the states the app offers and the course each one
studies. The app asks at launch, caches the answer under
`dmv-prep/states/v1`, and falls back — in this order — to that cache, then to
the three states the binary carries.

| Situation                                 | Picker shows                                                                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| the server answered                       | its list                                                                                                                    |
| unreachable, a cached answer exists       | the cached list, with "No connection — showing the states from your last visit" and a Try again                             |
| unreachable, first ever launch            | the three states the binary carries, with "No connection — the list of states is downloaded when you start" and a Try again |
| the answer has rows the app cannot render | those rows are dropped; the rest is used                                                                                    |
| the answer is empty or unparseable        | the last good list stands; treated as offline                                                                               |

Adding a state is a row, not a release: `add_state` over MCP, or
`PUT /v1/admin/catalogue/:stateCode`. A state can only be made **available**
once its course has a release — otherwise the phone would download a 404 —
so one is added parked, its course is built and published, and then it is
flipped on.

## Pictures

Pictures ride behind their lesson: when a body arrives (or is found
cached), its assets are ensured in the background, content-addressed by the
sha256 of their bytes, so a picture two lessons share is downloaded once and
a re-released lesson whose art did not change costs nothing. A picture that
is not there yet holds its space; one that is genuinely missing shows its
placeholder honestly and is fetched again next time. Each SVG is parsed
once per install (`CachedSvg`), never per mount.

## Not covered on purpose

- No offline guarantee: a lesson is usable offline only after its first
  online open. The alert wording tells the learner exactly that.
- The install gate does not retry on its own when the network returns; the
  learner taps "Try again".
