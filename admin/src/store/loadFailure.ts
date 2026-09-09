// Why a pane is empty. Kept apart from the store itself so it stays plain
// functions over plain data — and so a test can read it without dragging a
// browser's worth of globals along.

export const lessonKey = (versionKey: string, lessonId: string) =>
  `${versionKey}/${lessonId}`;

export type LoadErrors = Record<string, string>;

// The reason a lesson pane has nothing in it, when there is one: a failed
// request, or a document the renderer refused. A pane that just stays blank
// sends whoever is looking at it hunting through the server, the database and
// the renderer — all three of which were innocent the last time this happened.
export const failureFor = (
  errors: LoadErrors,
  versionKey: string | null,
  lessonId: string | null,
): string | null => {
  if (versionKey == null) {
    return null;
  }
  return (
    (lessonId == null ? null : errors[lessonKey(versionKey, lessonId)] ?? null) ??
    errors[versionKey] ??
    null
  );
};
