# Check-yourself recall card (`check_yourself`)

A lesson card that shows a rule the learner has just studied with its key
words blurred out. The learner reads the missing words from memory, taps
**Reveal words** (the blur dissolves into sharp outlined pills, gap by gap),
and then self-reports with **Not yet** / **I knew it**. Either answer
advances the deck — the card is deliberately unscored (active recall, not
grading). Built to the "Lesson format — card sequence" handoff, screens 19
(hidden, blurred) and 24 (revealed).

## Block shape

`check_yourself` is a regular lesson block in the v2 wire format
([`src/data/course/v2/wire.ts`](../../src/data/course/v2/wire.ts)), valid in
any position of `lesson.blocks`:

```json
{
  "blockId": "ca-road-markings-1-check-yourself-1",
  "type": "check_yourself",
  "title": "Can you finish the rule?",
  "context": "Recall · Yellow lines",
  "ruleMarkdown": "You may cross a solid yellow line to turn into a [[driveway]] — but never to [[pass]] another car.",
  "conceptId": "yellow-line-crossing",
  "scope": "universal"
}
```

| Field          | Required | Meaning                                                                                                                                         |
| -------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`        | yes      | The H1 above the card. Keep it an invitation to recall — "Can you finish the rule?", "What goes in the gaps?"                                   |
| `context`      | yes      | Uppercase label inside the green card. Convention: `Recall · <topic>`, where the topic names the rule being recalled ("Recall · Yellow lines"). |
| `ruleMarkdown` | yes      | One sentence, plain text. Every hidden word is wrapped in `[[double brackets]]`. No other markdown is interpreted.                              |
| `conceptId`    | no       | Same semantics as on every other content block.                                                                                                 |
| `scope`        | no       | `universal` or `state_specific`, as elsewhere.                                                                                                  |

There is no question, choice list, or checkpoint on this block — it never
references `questionIds`, and the self-report is not written to mastery or
lesson score. Only analytics hears it (`lesson_recall_revealed`,
`lesson_recall_answered { remembered }`).

## Gap markers

- `[[word]]` hides `word` behind a pill. A gap may span several words
  (`[[right-of-way]]`, `[[200 feet]]`) — the pill wraps as one unit.
- Validation (`recallGapErrors`, enforced by `validateLessonDocV2` /
  `validateModuleDocV2`) rejects the block when the rule has **no** gaps, an
  **empty** `[[]]` gap, or **unbalanced / nested** brackets. Generate, then
  validate — an invalid rule fails the whole document, same as any other
  schema error.
- The renderer keeps hidden words in the layout (blurred, not removed), so
  the sentence does not reflow on reveal. Everything between markers is
  rendered verbatim.

## Authoring guidance for generation

- **One sentence, one rule.** The card works when the sentence is the exact
  rule phrasing the learner saw 1–3 cards earlier (usually the `core_rule` or
  `remember_this` wording). Do not introduce new facts here.
- **1–3 gaps.** Hide the words that carry the decision — the object of the
  rule, the number, the exception — never articles or glue words. Two gaps is
  the sweet spot; more turns recall into guessing.
- **Placement.** Mid-deck or late-deck, after the rule has been taught.
  A good default deck slot is right before `remember_this`.
- **Sentence length.** Keep the rule under ~160 characters so it fits the
  card at 19px without scrolling.
- **Resume behaviour.** The revealed state is intentionally not persisted:
  reopening the lesson on this card starts it hidden again.

## Rendering contract (for reference, not per-lesson work)

The kicker is `Check yourself` (accent tone, check icon — `CARD_META` in
[`src/components/lesson/cards.ts`](../../src/components/lesson/cards.ts)).
The card itself is the deck's one full-colour card: fixed deep green
(`theme.colors.recall`, not accent-themed), white rule text. Hidden state
covers each gap word with a Liquid Glass pill on iOS 26 — the word reads as a
blur through the glass (screen 19) — and with an opaque pill on Android and
older iOS; the helper reads "The words are there — can you read them from
memory?" above a single **Reveal words** CTA. Revealing runs gap by gap with
a stagger: the glass dematerializes with UIKit's native animation while
screen 24's outlined pill chrome springs in around the now-sharp word; the
helper becomes "Just a self-check — either answer moves you forward." above
the **Not yet** / **I knew it** pair. The admin phone preview renders the
same component (a CSS blur stands in for the glass) with the same two-phase
footer.

## Compatibility

App builds older than this block type render the standard unknown-block
fallback card ("This card needs a newer version of the app") and the deck
continues — shipping `check_yourself` in a course update does not break old
clients, but plan the course release's `minAppVersion` if the card is central
to a lesson.
