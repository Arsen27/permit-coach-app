// Authoring helpers for the universal skeleton and for state lessons.
//
// A card is authored as a title plus an array of lines; every line becomes one
// chat message (a paragraph of at most two short sentences). Text may carry
// placeholders: {{state}}, {{agency}}, and any state parameter key such as
// {{speed.residential}}. A sentence whose placeholder resolves to null in a
// state is dropped from that state's card. Universal cards never carry literal
// digits or state names — the builder refuses them — so a value that differs
// between states must be a placeholder, a state note, or a state lesson.

const card = (type, title, lines, options = {}) => ({
  kind: 'card',
  type,
  title,
  lines,
  ...(options.bullets != null && { bullets: options.bullets }),
});

export const why = (title, lines, options) =>
  card('why_it_matters', title, lines, options);
export const rule = (title, lines, options) =>
  card('core_rule', title, lines, options);
export const related = (title, lines, options) =>
  card('related_rule', title, lines, options);
export const remember = (title, lines, options) =>
  card('remember_this', title, lines, options);
export const trap = (title, lines, options) =>
  card('exam_trap', title, lines, options);
export const visual = (title, lines, options) =>
  card('visual_example', title, lines, options);
// A state-specific card inside a state lesson (module 8) or a state override;
// the app shows it with the "<State> specific" kicker.
export const stateCard = (title, lines, options) =>
  card('state_specific', title, lines, options);

// Picture card: the asset id is bare (traffic-signals-a02); the builder prefixes
// it with the state code and pulls the SVG from courses/skeleton/assets.
export const image = assetId => ({ kind: 'image', assetId });

// Recall card: the rule sentence with the hidden words in [[double brackets]].
export const recall = (context, ruleMarkdown) => ({
  kind: 'recall',
  context,
  ruleMarkdown,
});

// Opening challenge: unscored, three choices, `correct` is the 0-based index.
export const challenge = (
  scenario,
  prompt,
  choices,
  correct,
  explanation,
  options = {},
) => ({
  scenario,
  prompt,
  choices,
  correct,
  explanation,
  ...(options.image != null && { image: options.image }),
});

// Lesson-test question, three choices, `correct` is the 0-based index.
// options.image names a bare asset id shown with the question.
export const q = (prompt, choices, correct, explanation, options = {}) => ({
  prompt,
  choices,
  correct,
  explanation,
  ...(options.image != null && { image: options.image }),
});

// Numeric question rendered from one state parameter: the correct choice is the
// parameter's value with `unit`, the distractors are the value plus each offset.
// Choices are shuffled deterministically per state so the answer position varies.
export const numq = (prompt, param, unit, offsets, explanation, options = {}) => ({
  prompt,
  numeric: { param, unit, offsets },
  explanation,
  ...(options.image != null && { image: options.image }),
});

export const lesson = (id, spec) => ({ id, ...spec });
