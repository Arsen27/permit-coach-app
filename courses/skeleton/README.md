# Universal course skeleton

One course, every state. The skeleton holds the 29 universal lessons of
modules 1–7 (chat-style cards, recall cards, opening challenge, six-question
lesson test); a state package supplies the values, the notes, and the four
lessons of module 8. `scripts/build-state-course.mjs <xx>` renders the tree
the server ships.

The skeleton is a data document, not code:

```
server/skeleton/skeleton.json  the skeleton itself — module list, the checks'
                        vocabulary, the 29 universal lessons with their
                        {{param}} placeholders unresolved, and the picture
                        library's alt text. What the builder reads, what the
                        server serves, and the only source of truth.
courses/skeleton/
  assets/*.svg          the pictures themselves — files, not data
  course.mjs            } the authoring sources the document was first
  helpers.mjs           } converted from, kept as history. They are NOT the
  modules/module-0N.mjs } source any more — authoring lives in Postgres and
  assets/index.json     } the document is written by the server's
                        } `npm run authoring:export`. Re-running
                        } convert-skeleton-to-json.mjs would renumber every
                        } card from its position, which drops cards inserted
                        } since (slide-04a and friends) and orphans the state
                        } notes and overrides that name them.
server/skeleton/states.json    the state packages as data: parameter values,
                        the notes each state anchors, its overrides, and the
                        state module's lessons.
server/skeleton/rules.json     each state's rule catalogue, projected to what
                        citing and validating a rule needs — the sentence and
                        the numbers the rule states. Regenerate both with
                        scripts/export-state-packages.mjs.
courses/states/<xx>/
  state.json            vars, params (each backed by a catalog rule), notes,
                        overrides, release metadata
  lessons.mjs           the state module(s): module 8 "Pass the <State> Test"
  assets/               optional SVGs + index.json: overrides by bare id, and the
                        state's own pictures (its module-8 lessons)
  build-report.md/json  written by the builder: where every block comes from
  release.json          the release request for the admin channel
```

## The three rules

1. **A universal card carries no literal number and no state name.** A value
   that differs between states is a placeholder — `{{speed.residentialMph}}`,
   `{{state}}`, `{{agency}}` — resolved from `state.json`. The builder refuses
   a digit or a state token in universal text (cards, recall rules, questions,
   alt text). `911` is the only allowed literal (see `UNIVERSAL_LITERALS`).
2. **Every parameter cites a catalog rule that states its number.** The
   builder checks the value's digits against the rule's `values`,
   `authoringRule`, `conditions` and `exceptions`. A handbook-only value is
   allowed with `"status": "needs_review"` and is listed in the report.
3. **A state-only rule is a note or an override, never an edit to the
   skeleton.** A note is a short `state_specific` card placed after the
   skeleton card it extends (`"after": "<lesson>-slide-NN"`), optionally with
   its own picture. An override replaces one skeleton card or question by id.
   Both are counted in the report so the difference between states stays
   visible.

## Emoji

The builder injects the concept emoji from `scripts/emoji-layer.mjs` into
card bodies, bullets, and challenge scenarios: every mention of a concept,
one space between the emoji and the word. Author the skeleton and state text
without emoji. Titles, recall rules, and questions never get emoji.

## Placeholders

- `{{key}}` → the parameter's `value` (numbers ≥ 1000 get a thousands
  separator; strings are used verbatim).
- A sentence whose placeholder is `null` in a state is dropped from the card;
  a recall card whose every sentence drops is dropped whole (reported).
- Questions never drop: a `null` parameter used in a question is an error —
  override the question in that state instead.
- `numq(prompt, param, unit, offsets, explanation)` renders a numeric question
  whose distractors are the value plus each offset, shuffled per state.

## Building

The builder moved into the server: `server/src/admin/buildStateCourse.mjs`, the
same file, reading the authoring documents out of Postgres instead of off this
disk. Generation is an action in the panel — the **Train** tab — not a command
on somebody's laptop. What is left here are the two converters that feed it:

```
node scripts/convert-skeleton-to-json.mjs           # .mjs → server/skeleton/skeleton.json
node scripts/convert-skeleton-to-json.mjs --check   # is the document current?
node scripts/export-state-packages.mjs              # state packages → states.json + rules.json
```

and, in the server repo:

```
npm run assets:upload      # the picture library into the asset store, once per database
npm run authoring:export    # the working documents back to these files
```

Output goes straight into the database as a release, no tree and no git step.
The builder still emits the schemaVersion-2 form — artwork inline, which is
what the fingerprints were taken over — and the server converts it to
schemaVersion 3 on the way in, exactly as the importer does for a tree.

**Lockstep.** CA and TX move together on one version: if either fails to build,
no version is cut for anyone, and the failure names the state, the lesson and
the reason. Florida is not a member — it has no state package and keeps its own
1.0.0, which is a different course's number. Instructions are computed by
diffing each state's new documents against its previous release, so a state
whose content did not move gets `instructions: []`; nothing ever emits `full`,
because one `full` in a pending slice makes a device refetch the whole course.
Publishing from the panel reaches staging; production stays a button a human
presses.

## Adding a state

1. Copy `courses/states/ca/state.json`, change `stateCode`, `courseId`,
   `idPrefix`, `vars`, `course`, `release`, and point `ruleCatalog` at the
   state's catalog.
2. Fill `params` — every key the skeleton uses (`build --check` lists the
   unknown ones). Use `null` for a value the state does not codify.
3. Write `notes` for rules the skeleton cannot express with a value, and
   `overrides` for the few questions that only make sense with the state's own
   numbers.
4. Write `lessons.mjs` for module 8.
5. `build --check` until it is clean; read `build-report.md`: everything
   marked *identical* is byte-for-byte the skeleton, already validated.

## Validation the builder runs

Errors (build refused): digits or state tokens in universal text; unknown
placeholder; `null` parameter in a question; parameter value not stated by its
rule; note or override with a missing anchor; numbers in a note without a
rule citation; recall without 1–3 `[[gaps]]`; duplicate ids; a 10-word run
shared with a competitor lesson (`DMV_COMPETITOR_ROOT`, default
`../dmv-competitors`).

Warnings (reported): card outside 42–135 words; sentence over 38 words;
a message with more than two sentences; lesson theory outside 285–560 words;
lesson without a recall card; parameter declared but unused.

## Where the sources actually live

Since step 2 the working documents live in **Postgres**, not in these files:
`authoring_documents` holds one row per subject (the skeleton, and one per state
package), `authoring_revisions` holds the named snapshots, and
`authoring_edits` is the log a release will be stamped against. The files above
are the **seed** — they populate a subject that has no row yet — and the
**mirror**: `npm run authoring:export` in the server repo writes the working
documents back to them and to `courses/states/<xx>/state.json`. Run it after a
session in the panel and commit what changed; the round trip is byte-exact, so
an untouched export rewrites nothing.

## What the panel shows

The admin's **Skeleton** tab (the switch in the header, next to *State course*)
renders the skeleton with the same card components the course editor uses, and
edits it. Two things are marked, because they are the two ways a
state's course stops being the skeleton: a yellow border on every
`state_specific` block — the notes a state anchors onto a shared card and the
lessons of the state module — and a chip in place of every `{{param}}`, so a
number or a state's name reads as the variable it is. The tab is fed by
`GET /v1/admin/skeleton` and `GET /v1/admin/skeleton/parameters`.

Three places an edit can land, and exactly three:

- a **shared card**, in the Skeleton tab — every state gets it;
- **one state's disagreement** with a shared card, made on that state's own
  screen — it becomes `overrides.cards[<bare block id>]` in that state's
  package, which is what this builder already reads. *Promote into the
  skeleton* moves it the other way and clears the override;
- a **state's own material** — its notes and its module-8 lessons — edited in
  the Skeleton tab on a yellow block, which writes to that state and nothing
  else.

A course version generated from this builder can no longer be patched block by
block through a draft: the next build would discard the edit, so the edit
endpoints refuse it and say which of the three places it belongs in. Versions
nothing regenerates — the git-era imports — are edited exactly as before.

The panel refuses on save what the builder would refuse on build: no literal
number and no state name in shared text, a rule citation for every number in a
state's own text, and every digit of a parameter stated by the rule it cites.

Every release records what produced it — the skeleton document's revision, the
state package's, and the builder's version — in its manifest entry and in the
`provenance` column of `course_releases`, so a release can be traced back to
the three inputs that made it.
