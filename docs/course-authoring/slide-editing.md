# Editing slides in the panel

What an author controls about a lesson slide, and what the wire format promises
in return. Companion to [slide-course-v2.md](slide-course-v2.md).

## A slide is not a block

The player builds cards out of `lesson.blocks`, and the mapping is not one to
one: an `image` block folds into the block that follows it, and a block with a
`checkpointQuestionId` produces a second card of its own. The panel edits
**slides** — one card the learner swipes to — and moves them as whole units, so
a folded illustration always travels with the card it belongs to. The rules live
in `admin/src/model/slides.ts` and mirror `buildCards()` exactly; if one changes,
both change.

## Type and kind are different things

- **Kind** is behaviour, and it is the block family: teaching copy
  (`core_rule`, `exam_trap`, …), a quiz (`quick_challenge`), or a recall card
  (`check_yourself`). Converting between kinds mints or detaches the question
  the target kind needs.
- **Type** is presentation only: the kicker's words, its icon and its colours.

Types are authored per course in `course.cardStyles` and edited under
**Slide types…** in the editor:

```jsonc
{
  "styleId": "road_hazard", // a new type; a block opts in via its styleId
  "label": "Road hazard",
  "icon": "triangle-exclamation", // a name from src/assets/icons.ts
  "tone": "trap", // palette slot used when no colour is set
  "textColor": "#B45309",
  "iconColor": "#D97706"
}
```

A `styleId` that matches a built-in block type (`core_rule`, `exam_trap`, …)
**overrides that family for the whole course**. Any other id is a new type that
individual blocks point at through their own `styleId`. `checkpoint` is
reserved: it styles the standalone question card, which has no block of its own.

Two safety rules hold this together:

- A style may only be deleted once no block still names it. The server refuses
  the save otherwise, listing the ids still in use.
- An icon name a build does not know falls back to the block family's own icon
  rather than blanking the kicker, so a course authored against a newer icon set
  still renders on an older app.

## Icons ship with the course

`icon` names a glyph compiled into the app (`src/assets/icons.ts`, 16 of them).
`iconSvg` is a glyph the **course** carries, so a new icon needs no app release.
It wins where the build understands it, and `icon` stays the fallback where it
does not.

**Colour is decided by the artwork**, which is ordinary SVG semantics rather
than a rule of ours: paths drawn in `currentColor` take the card's `iconColor`,
paths with their own fills keep them. The panel offers the choice at upload
time and rewrites the file accordingly, so nothing downstream needs a flag for
it — and a glyph that declares no paint at all is tinted rather than left to
render as a black silhouette.

### What it costs a learner

A glyph rides inside the course document, and **the client fetches course.json
in full on every version bump** — there is no per-document sha skip. So every
icon byte is paid on every update, however small the update was. That is why
there are caps rather than only checks:

|                             |                                                         |
| --------------------------- | ------------------------------------------------------- |
| `MAX_ICON_SVG_BYTES`        | 4 KB per glyph — the app's own set runs 322 B to 2.1 KB |
| `MAX_CARD_STYLES_SVG_BYTES` | 32 KB per course ≈ 40 typical glyphs                    |

Uploads are minified first (XML prologue, comments, `<title>`/`<desc>`,
`<metadata>`, editor namespaces), and the manager shows the running total
against the budget so the cost is visible while it is being spent.

The course document is the cheapest place for them: it is one small
AsyncStorage row, it is never duplicated per module, and a glyph never enters a
lesson or module document.

### Releasing an icon on its own

A change confined to the course document produces **no instructions**, and that
is deliberate. `buildDraftDiff` reports it as `courseMetaChanged` and suggests a
patch; `verifyRelease` accepts an empty instruction list exactly when no lesson,
module or course structure changed.

An empty list already means the right thing to every client ever shipped:
`planContentFetch([])` plans no downloads, the version bump alone causes
course.json to be fetched, and every module is carried forward from the device.
Inventing a `course` op would have been worse — `planContentFetch` treats an
unrecognised op as `full`, so older builds would re-download the entire course
to learn one icon.

## Bodies are ordered element lists

A teaching block's body is `content`: an ordered list of `paragraph`, `bullets`
and `image` elements. Artwork can therefore sit anywhere in the prose, as many
times as the slide needs, instead of only above the title.

Blocks authored before this existed carry only `bodyMarkdown` and `bullets`.
`blockElements()` reads both shapes as the same list, so nothing shipped changes
and there is no migration: a block gains `content` the first time an author
edits its body.

The legacy fields stay populated as a flattening of `content` — paragraphs
joined with blank lines, bullets concatenated — so an older app build still
shows the prose. Because of that mirror, `bodyMarkdown` is allowed to be empty
**only** when `content` is present; a card whose body is nothing but artwork
flattens to no prose at all.

An element kind a build does not know is preserved verbatim and skipped by the
renderer, on the same contract as unknown block types.

## The body is edited a line at a time

The panel does not edit elements — it edits **lines**. `bodyRows()` splits a
`bullets` element into one row per item and `rowsToElements()` merges adjacent
bullet rows back, so a bullet can be dragged out of its list and a paragraph
dropped into the middle of one without the author ever thinking about elements.

Each row is one line tall and grows only as far as its own text needs. The
sizing is CSS-only (`AutoGrow` in `features/editor/fields.tsx`): a hidden twin
carries the same string through `data-value`, and the textarea is laid over it —
no measuring, no resize observers, no reflow while typing.

Rows are moved by the handle on their left, not by grabbing the text: the row
only becomes `draggable` once the handle is pressed. A row is removed by the ✕
on its right, by right-clicking it, or by Backspace on an empty line. Enter
opens the next line and carries the caret with it; Shift+Enter stays inside the
current one. Adding is a single bar under the list rather than a control between
every pair of lines.

A line left blank is an ordinary state to be in halfway through writing, so the
format tolerates empty paragraph text and empty bullet items. Nothing else does:
the renderers skip blank lines, `elementsToMarkdown`/`elementsToBullets` leave
them out of the legacy mirror, and `withoutBlankElements()` strips them from the
document on save — the release validator only ever sees real content.

## References stay exact

The wire format demands that nothing dangle and nothing be carried along unused:
every asset a block draws must be in `lesson.assetIds`, and every question in
`lesson.questionIds` must be reachable from a block. `reconcileReferences()` in
the panel re-establishes both after any structural edit, so deleting a slide
takes its artwork and its checkpoint question with it.

It only ever drops what no block asks for any more. A split lesson's scored test
bank is not referenced by any block and is deliberately left alone.

## Where the pieces are

| Concern                                  | File                                                                |
| ---------------------------------------- | ------------------------------------------------------------------- |
| Types, validators, `blockElements`       | `src/data/course/v2/wire.ts` (copied to `server/src/admin/wire.ts`) |
| Kicker resolution                        | `src/components/lesson/cards.ts`                                    |
| Card rendering (app _and_ panel preview) | `src/components/lesson/LessonCardBody.tsx`                          |
| Slide grouping, ordering, reconciliation | `admin/src/model/slides.ts`                                         |
| Slide editor                             | `admin/src/features/editor/EditCardList.tsx`                        |
| Slide-type manager                       | `admin/src/features/editor/SlideTypesModal.tsx`                     |
| Persistence                              | `server/src/admin/drafts.ts` (`saveLessonDoc`, `saveCardStyles`)    |
