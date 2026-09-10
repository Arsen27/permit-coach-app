# Course architecture

Where the two state courses come from, and where an edit to them belongs.

## The shape

There is one universal **skeleton** and one **package per state**. Neither is a
course: the courses are *generated* from them.

- `server/skeleton/skeleton.json` — the universal lessons: cards, questions,
  the picture library's alt text, and the vocabulary the builder validates
  against. Shared text carries no literal number and no state name; a value
  that differs between states is a `{{placeholder}}`.
- `courses/states/<xx>/state.json` — one state's package: what each placeholder
  is worth and which rule of that state's catalogue says so, the notes it
  anchors onto shared cards, its disagreements with shared cards
  (`overrides.cards` / `overrides.questions`), its own lessons, and any picture
  it replaces.
- The working copies of both live in Postgres (`authoring_documents`), with
  numbered immutable revisions and an edit log. The files above are the seed
  and the mirror — `npm run authoring:export` writes them back byte-exact.

`server/src/admin/buildStateCourse.mjs` turns a skeleton plus one package into
a course tree, and `generate.ts` runs it as a **train**: CA and TX are cut at
one version or at none at all, with update instructions computed from what
actually moved. Florida is not a member — it has no package and keeps its own
version line.

**An edit lands in exactly one of three places**, and nowhere else:

| The change | Where it goes | Who gets it |
| --- | --- | --- |
| Shared wording, every state | the skeleton | everyone |
| One state disagrees with a shared card | that state's `overrides` | that state |
| A note, a state lesson, a parameter, a picture | that state's package | that state |

## Chat agents edit the source, not the generated courses

A generated course version is rebuilt wholesale by the next build, so patching
its documents is a dead end: the edit survives until somebody runs the builder,
and then it is gone. That already cost a real image change once. So the origin
guard *refuses* a block edit whose id originates in the skeleton, and the
refusal names the package the edit belongs in.

The MCP surface therefore has its own door to the source, and a chat agent
should use it for anything in CA or TX:

| Tool | What it does |
| --- | --- |
| `skeleton_status` | source revision, per-member package revision, edits waiting to be cut, released/staging/production versions |
| `skeleton_read` | `{query}` → anchors with a ≤120-character excerpt and scope; `{anchor}` or `{questionId}` → that one block plus what each state resolves it to |
| `skeleton_edit` | a shared card or question — **every state gets it** |
| `state_create` | starts a state: an empty package the skeleton renders against. Joins no train |
| `state_edit` | one state only: an override, a note, a state lesson card, a parameter, a picture, or `{kind: train}` membership. `patch: null` reverts |
| `train_generate` | builds every member at one version; **a dry run unless `dryRun: false`** |
| `train_publish` | points staging at an already-generated version, for every member |

`create_draft` / `edit_block` / `release_draft` remain the path for imported
courses that nothing regenerates — the git-era releases, and any course that
has no package.

### Adding a state

Neither step needs a deploy any more. `state_create` writes the package; the
placeholders, notes and lessons are then edited into it with `state_edit`; and
`state_edit {kind: 'train', patch: {member: true}}` puts it on the train.

Membership is a `train` flag on the package — it exports and travels with it —
rather than a literal in `generate.ts`, and the flag is guarded: **joining runs
the builder for that state at the version the train would move to next, and is
refused, with the builder's own reasons, if it does not build.** Generation is
all-or-nothing, so a half-built member would refuse the release for the states
that are finished; a new state must never arrive as an outage for the ones that
work. A package may stay unfinished for as long as its author needs. It simply
cannot be a member while it is.

A joining state brings its own release history, which may be ahead of the
train's — fl-class-e was cut by hand at 1.0.0 long before any of this — so the
train's next number clears both.

Two properties hold whichever door an edit comes through, because both call the
same functions in `server/src/admin/skeletonService.ts`:

- **The builder's rules are applied before the write.** A literal number or a
  state name in shared text, a state's number without a rule citation, a
  parameter whose digits its cited rule does not state, an override on a
  lesson's opening challenge — all refused, with the reason, at edit time
  rather than at build time. Under lockstep one refused edit is a release
  nobody gets, so it is worth catching early.
- **Production is not reachable.** `train_publish` reaches staging and stops;
  every generated version is written with `publicationAuthorized: false`.
  What every install downloads stays a button in the panel, pressed by a human
  who has seen the release on a phone.

Writes from a chat are recorded as the `mcp` actor in the authoring edit log,
so a panel edit and a chat edit stay distinguishable in the revision history.

### Why the tools look the way they do

Reading a course into a chat to fix one sentence costs about 160k tokens; the
fix itself is worth about a hundred. So the surface is built to a budget: a
search returns anchors and short excerpts, a full body comes back only when one
item is asked for by id, a write answers with a receipt
(`{applied, changed, affects, revision, pending}`) rather than the text it was
just handed, and `train_generate` reports counts, ids and op names — never
content. Anything that would overrun truncates and says so. End to end, a
single card edit — status, read, edit, dry run — is roughly 750 tokens.
