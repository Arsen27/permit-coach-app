# Integration assumptions and intentionally unimported fields (CA-2026.08.02-r02)

## Architectural decision

The handoff instructs adapting to the existing architecture. The app bundles
content as static JSON/TS in `src/data/` and has no content tables in Supabase
(progress tables reference content ids as opaque text). The importer therefore
generates a bundled JSON store (`src/data/course/ca-2026-08-02-r02/`) instead
of DB rows. "Rows" in the handoff's acceptance checks map to JSON entities;
idempotency means a re-run of `npm run course:import` updates or no-ops
(verified by `__tests__/courseImport.test.ts`). No Supabase schema change was
required: all ids fit the existing 64-char text-key columns.

Two alternatives were considered and deliberately not built now: (a) serving
the course via the dormant `server /v1/content/:version` endpoint — the app has
no downloader for it; (b) new Supabase content tables — a redesign the handoff
forbids unless required for data integrity, which it is not.

## Publication

The integration initially kept the course non-public per the handoff. On
**2026-08-03 the owner (Arsen) explicitly authorized full publication** during
the integration session, superseding the handoff's review-pending default; the
formal human-review items from the final QA report remain open and are now the
owner's responsibility.

Implementation of that decision:

- `PUBLISHED_COURSE_ID` in `src/data/course/index.ts` is set to
  `ca-2026-08-02-r02` — the app-level analog of `currentCourseVersionId`.
- Package files and generated data were **not** rewritten: `status` remains
  `ready_for_review` and `publishedAt` remains `null` as the package's own
  record (asserted by tests). The pointer, not that field, controls exposure.
- The Learn tab renders the course's 13 modules (sequential lesson unlock,
  module tests scored via `topic_scores` keyed by module id); the theory
  screen renders the course lesson content; lesson quizzes and module tests
  feed the existing quiz engine through `src/data/course/adapters.ts`;
  saved/mistake ids resolve against the course question bank.
- The legacy placeholder unit in `@/data/curriculum` stays only as the
  question source for the right-of-way practice topic and a theory fallback.

## Assumptions

1. The handoff package directory at the repo root is the editorial source of
   truth and stays available for re-imports (importer tests skip if absent).
2. Package-file SHA-256 checksums (112/112 verified) are sufficient integrity
   proof; the manifest's canonical `contentHash` is carried as metadata, not
   recomputed, because its canonicalization procedure is not specified.
3. `sequence` for lessons is not present in the package; array order in the
   module files is authoritative and is materialized as a 1-based `sequence`.
4. `estimatedMinutes` stays a string (`"2-5"`) as shipped.
5. The two-representation question design is resolved by importing only
   `questions.json` entities; nested copies were verified byte-identical and
   reduced to id references.

## Intentionally not imported (stay in the handoff package / audit layer)

- `rules.json`, `dependency-map.json`, `evidence/`, `reports/`,
  `package-checksums.json` — audit/QA layer; the app has no source-information
  screen.
- Per-entity audit fields: `dependsOnRules`, `citations` (incl. legal URLs),
  `relatedRuleIds`, `citation`, `internalQa`, `qaStatus`, `blueprintId`,
  per-entity `jurisdiction`/`state`/`courseVersion` (kept once at version
  level), lesson-level legal-freshness triplet (kept at version level),
  redundant `correctAnswer`/`distractors` (derivable from
  `choices` + `correctAnswerId`; equality validated before stripping).
- Visual briefs (`heroVisualBrief`, `visualBrief`) — production instructions
  for designers, not learner content; no finished/licensed assets exist, so
  nothing image-like is shipped and no diagrams are auto-generated.
- `ruleId` inside `plainEnglishExplanation[]` and `numbersAndLimits[]`.

## Blocked topics

Projecting-load flag dimensions and the minor knowledge-test retest interval
are deliberately absent from the package and were not reconstructed. The
importer fails hard if matching phrases ever appear in emitted learner text,
and the content tests re-assert absence. ("18 inches" occurrences are the
legitimate curb-parking rule, not the flag topic.)

## Flag for human review

Learner-visible question texts contain internal rule codes (e.g.
`CA_VEH_12500_LICENSE_REQUIRED`) in `explanation` and
`whyDistractorsAreWrong` — 1125 mentions. This is how the package was authored
(its own QA passed), but the phrasing may not be ideal for learners. Content
was imported verbatim (the handoff prohibits editing package content in
place); if this should change, it needs a new package revision (r03), not
local edits.
