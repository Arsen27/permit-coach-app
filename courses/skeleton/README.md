# Universal course skeleton

One course, every state. The skeleton holds the 29 universal lessons of
modules 1–7 (chat-style cards, recall cards, opening challenge, six-question
lesson test); a state package supplies the values, the notes, and the four
lessons of module 8. `scripts/build-state-course.mjs <xx>` renders the tree
the server ships.

```
courses/skeleton/
  course.mjs            module list, universal literals, forbidden state tokens
  helpers.mjs           why/rule/related/remember/trap/visual/image/recall/challenge/q/numq
  modules/module-0N.mjs universal lessons — no literal digits, no state names
  assets/               shared SVG library + index.json (alt, size, baked numbers)
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

```
node scripts/build-state-course.mjs ca --check      # validate, write nothing
node scripts/build-state-course.mjs ca              # write server/content/ca-class-c/<version>
SKELETON_MODULES=1,2 node scripts/build-state-course.mjs ca --check   # while authoring
```

Output: `server/content/<courseId>/<version>/{course.json,modules/*.json,lessons/*.json}`
in the schemaVersion-2 tree format, the manifest entry, `build-report.md`,
and `release.json`. The tree is delivered through git: commit it in the
dmv-server repo, deploy, then from the connector run `import_content_tree`
(registers the release and merges its questions into the working bank),
`publish_staging`, and `publish_bank_staging`. Production stays a button in
the admin panel.

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

