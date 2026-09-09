# How questions get chosen

Answers PC-13: _"how do the exam questions get chosen — just random?"_

Short version: **yes, it is random — but there are two different exams, drawn
from two different pools, with two different draw rules.** Neither of them
looks at how the learner has answered before.

Every selector lives in [`src/data/practice.ts`](../src/data/practice.ts); the
screen that turns a session into questions is `buildQuestions()` in
[`src/screens/QuizScreen.tsx`](../src/screens/QuizScreen.tsx).

## The pools

| Pool                                                            | Size                                                        | Where                                     |
| --------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------- |
| Course bank (state-specific, versioned, updatable over the air) | 224 questions, 8 modules × (4 lessons × 6 + 12 module-test) | `src/data/course/<course>/questions.json` |
| Authored practice bank                                          | 24 (3 topics × 8)                                           | `src/data/practiceQuestions.json`         |
| Authored right-of-way lesson                                    | 8                                                           | `src/data/curriculum.ts`                  |
| Sign flashcards, generated one per sign                         | 71                                                          | `src/data/signs/signsData.json`           |

"Authored" below means the practice bank + the right-of-way lesson — 32
questions, the constant seed content that predates the course pipeline.

The shuffle is a plain Fisher–Yates over `Math.random()`
([`shuffle()`](../src/data/signs/index.ts)). There is no seed, so a retake is
always a fresh draw, and the app cannot reproduce a past paper.

Sign flashcards are generated, not authored: `signQuestion()` builds "What does
this sign mean?" with three distractors, preferring other signs from the _same_
category so the options are plausible.

## Exam 1 — Practice → mock DMV test (`examQuestions()`)

The 46-question timed mock exam on the Practice tab. 60-minute clock, 83% to
pass (`EXAM_LENGTH`, `EXAM_PASS_PERCENT`).

1. Shuffle the 32 authored questions, take 24.
2. Take `46 - 24 = 22` sign flashcards, drawn at random from all 71 signs.
3. Shuffle the 46 together.

So the mix is fixed at **24 authored + 22 sign flashcards**, and the draw is
uniform random inside each half. Nothing is weighted, ordered, or filtered.

Two consequences worth knowing:

- **The course bank never appears in this exam.** 224 state-specific questions
  — the content we actually ship and update per state — are not in the pool.
- **Retakes repeat heavily.** Taking 24 of 32 authored questions means two
  sittings overlap by ~18 of those 24 on average, and 48% of the paper is
  "name this sign".

## Exam 2 — Learn → final exam (`finalExamQuestions()`)

The exam at the end of the ladder. Same length and pass mark, but drawn
**only from the course the learner just finished** — no authored bank, no sign
flashcards, so passing it means "I know this course".

The draw is deliberately _not_ a flat shuffle:

1. For each module, pool its lesson-test questions (`testQuestionIds` falling
   back to `questionIds`) plus its module-test questions, and shuffle that pool.
   Today that is 24 + 12 = 36 candidates per module, 8 modules.
2. Walk the modules **round-robin**, taking one question per module per round,
   skipping ids already picked (a question can be referenced by both a lesson
   test and its module test), until 46 are picked.
3. Shuffle the 46 so the paper does not walk the course module by module.

Round-robin is the point: a flat shuffle over modules of unequal size can leave
a whole unit unexamined, and this is the one test that claims to cover
everything. With 8 modules and 46 questions each module contributes 5–6
questions. Within a module the pick is random, so a retake is a different paper.

## Everything else

| Mode                         | Draw                                                   |
| ---------------------------- | ------------------------------------------------------ |
| `lessonTest`                 | The lesson's canonical questions, `courseLessonQuiz()` |
| `moduleTest`                 | The module's 12 canonical questions, shuffled          |
| `topic` (`road-signs`)       | 10 random sign flashcards                              |
| `topic` (`right-of-way`)     | All 8 lesson questions, shuffled                       |
| `topic` (other 3)            | That topic's 8 questions, shuffled                     |
| `quickMix`                   | 32 authored + 10 sign flashcards, shuffled, first 10   |
| `signsQuiz` / `categoryQuiz` | 20 random signs / 10 random signs in a category        |
| `saved` / `mistakes`         | Exactly the persisted ids, in stored order             |

## What is _not_ used for selection

[`src/state/questionStats.ts`](../src/state/questionStats.ts) tracks per-question
`seen` / `correct` / `lastCorrect` and derives a five-state mastery label
(`mastered`, `seenOnce`, `shaky`, `missed`, `unseen`).

That data drives **display only** — the Practice bank map, the per-topic
accuracy row, and an analytics property. **No selector reads it.** There is no
spaced repetition, no weighting toward weak areas, no "unseen first". The
closest thing is the `mistakes` mode, which the learner has to start by hand.

## Open decision points

Not changed here — flagged for a product call:

1. Should the mock DMV exam draw from the course bank instead of (or as well
   as) the 32-question authored bank? It is the marquee feature and currently
   uses the smallest, oldest pool we have.
2. Is 48% road-sign identification representative of a real DMV knowledge test?
3. Should any session weight by `questionStats` — e.g. bias the draw toward
   `missed` / `unseen` questions?
