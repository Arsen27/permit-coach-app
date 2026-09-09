# Server-driven content (the lazy model)

The app ships **no course content**. At start it downloads the course
**outline** and **question bank** for the learner's state (during
onboarding, before the paywall — `installCourse`), lesson bodies arrive the
first time each lesson is opened, and pictures ride behind their lesson in
the background. This document is the operating manual for authoring,
releasing and publishing.

**Two repositories, and neither of them holds a release.** The server lives
in `Arsen27/dmv-server`; the `server/` directory in the app repo is its
working copy (git-ignored here). Content lives in the server's database, so
publishing is a pointer move over the admin API — never a commit, never a
deploy.

## The three kinds of content

| Kind                               | Identity                   | Update semantics                           |
| ---------------------------------- | -------------------------- | ------------------------------------------ |
| **course** (outline + lesson docs) | semver releases per course | governed by the release's taxonomy (below) |
| **question bank** (one per course) | sha256 of the document     | wholesale, for everyone, on the next check |
| **signs catalogue** (global)       | sha256 of the document     | wholesale, for everyone, on the next visit |

Tests live in the bank, separate from the course: the outline's lessons
carry `questionIds` / `theoryQuestionIds` / `testQuestionIds`, and the app
draws the questions from the bank — so the final exam works for lessons
never opened, and a question fix reaches every user without a course
release. Banks and signs are edited as one working document
(`PUT /v1/admin/bank/:courseId/doc`, `PUT /v1/admin/signs/doc`) and
published by snapshot: staging snapshots the working doc, production names
a sha that staging has served; rollback is publishing an older sha.

The pool also rides the course pipeline: **releasing a draft merges its
questions into the bank working doc and stages the bank** (the release's
copy wins for its ids; pool-only questions stay), and **publishing a course
to production promotes the staged bank to production first** — the pool
everyone downloads is the one the staging device was reviewed against.
Question copies still embedded in old release documents are an authoring
artifact: the app never reads them.

## How the app hears about it

```
app start / foreground (throttled, 15 min)
  → GET /v2/bootstrap?course=<id>&channel=<production|staging>
        &courseVersion=<held>&appVersion=<build>
  → one answer: the course verdict + the bank's production sha
    + the signs catalogue's sha
  → verdict `replace` → GET /v1/course/:id/outline?version= → swap outline,
    sweep cached bodies whose hash the new outline dropped, refresh bank
  → verdict `offer`   → modal; accepting wipes the course keys and installs
  → nothing            → nothing
opening a lesson
  → GET /v1/course/:id/:version/lessons/:lessonId (verified against the
    outline's {sha256, sizeBytes}, cached on device by hash, assets ensured
    in the background)
```

The verdict is computed **server-side** (`server/src/verdict.ts`): the
servable set is the channel's history ∪ its current version, fix chains are
walked from the held version, and nothing above a `minAppVersion` the build
does not meet is ever mentioned (`appUpdateRequired` says why). The app
never compares version numbers itself. (`/v1/bootstrap` still answers for
the `legacy-offline-course` branch.)

## Release taxonomy

Every release names what it means for devices in the field
(`update_kind`, `update_subtype`, `replaces`, `changed_lessons`,
`update_message` on `course_releases` — migration `0014`):

| Kind     | Version rule                                                                       | Subtypes                                                                                                                                            |
| -------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fix`    | patch bump (same `major.minor` lineage; `replaces` may widen it to named versions) | `silent` — replaced quietly · `apology` — one modal, completed changed lessons turn yellow until retaken · `rules` — same, worded as a rules change |
| `course` | minor/major bump                                                                   | `new_users` — existing devices never hear of it · `offer` — one modal with an explicit progress-loss warning                                        |

`changed_lessons` is computed from doc-hash diffs against every version the
release covers — the yellow marks and the outline sweep both key off it.
The panel's release dialog derives the kind from the version number and
offers the matching subtypes with the message the learner will read; over
MCP the same fields ride `release_draft`.

## Releasing and publishing

Two decisions, kept apart: a **release** is an immutable version that
serves nowhere; **publishing** points a channel at one.

From the panel or a chat: duplicate any release into a draft, edit, release
(`releaseDraft` checks the taxonomy — a fix must be a patch, a course
update must not carry `replaces`, the number must top every existing one),
then `POST /v1/admin/courses/:id/channels/{staging|production}/publish`.
Production only accepts a version that is or has been on staging, so the
process is held by the server: release → staging → look at it on a device
(You → Developer → Content channel, behind `STAGING_KEY`) → production.
Rolling back is the same move to an older version — devices above the
channel take its version whole. Every move is recorded with who made it.

Chat models (MCP) can do everything **except touch production** — for
courses, banks and signs alike, the production publish is a button a human
presses.

## Invariants

- **Released documents are immutable** (ETag = doc sha256, cached as
  immutable), and a version number that was ever served is burned — content
  is addressed by hash, so a reused number would meet a poisoned cache.
- **Artwork is a file, not markup in a document**: named by the sha256 of
  its bytes, shared across lessons and releases, never deleted. A release
  that names a file nobody uploaded cannot be released. Unsafe SVG
  (scripts, event handlers, external references) is refused at upload.
- **The states list is data, not a build** (`GET /v1/courses`,
  `add_state` over MCP): adding a state is a row; it can only be made
  available once its course has a release.
- **JSON columns cross the driver boundary as text** (`$n::text::json(b)`):
  porsager and PGlite disagree on bare casts, and
  `jsonColumnCast.test.ts` refuses the direct form.

## Related pieces

- Server: `src/verdict.ts` (the verdict), `src/contentDb.ts` (releases,
  channels, history), `src/bankDb.ts` / `src/bank.ts` (banks),
  `src/admin/release.ts` (taxonomy validation, changed-lessons),
  `src/admin/mcp.ts` (chat tools).
- App: `src/data/course/lazy.ts` (the store: outline, bank, bodies, yellow
  marks), `SyncManager.tsx` (checks, modals), `useLessonBody.ts`
  (per-lesson download + the no-connection alert),
  `useCourseInstall.ts` (onboarding install).
- Resilience: `docs/course-integration/update-resilience.md` — every
  failure the device is built to survive.
- The pre-redesign system (full offline install, manifest deltas,
  severity instructions) lives on the `legacy-offline-course` branch of
  both repos.
