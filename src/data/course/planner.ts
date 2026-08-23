// Pure update planning: which docs to fetch for a version jump, and what to
// do with user progress per instruction severity. No IO — the updater owns
// fetching, verification, storage, and prompts.
//
// v2 stable ids are flat slugs (module `ca-read-the-road`, lesson
// `ca-sign-shapes-and-colors`) — lesson ids no longer extend their module id,
// so module scopes resolve through the bundle structure instead of prefixes.
// The shared `ca-` prefix still separates course progress keys from practice
// topics (`road-signs`, …) for full-course scopes.

import type {
  CourseBundleV2,
  UpdateInstructionV2,
  UpdateSeverity,
} from './v2/wire';

export const COURSE_PROGRESS_PREFIX = 'ca-';

export type ContentFetchPlan = {
  full: boolean;
  moduleIds: string[];
  lessonIds: string[];
};

export type ScopeReset = {
  lessonIds: string[];
  topicIds: string[];
};

export type UpdatePrompt = {
  userId: string;
  kind: 'hard' | 'optional';
  message: string;
  // Applied only when the user picks "Redo" on an optional prompt; empty for
  // hard prompts (their resets are applied before the prompt is shown).
  optionalReset: ScopeReset;
};

export type ProgressPlan = {
  hardResets: ScopeReset;
  prompt: UpdatePrompt | null;
};

export type ProgressKeys = {
  lessonIds: string[];
  topicIds: string[];
};

// Which docs a delta jump needs. `lessonOwner` maps lessonId → moduleId in the
// CURRENT bundle; lesson-level ops on modules that are refetched anyway are
// subsumed. Unknown lessons stay in lessonIds — the updater resolves their
// owner from the fetched lesson doc and escalates to the module doc if needed.
export const planContentFetch = (
  instructions: UpdateInstructionV2[],
  lessonOwner: Map<string, string>,
): ContentFetchPlan => {
  if (instructions.some(instruction => instruction.op === 'full')) {
    return { full: true, moduleIds: [], lessonIds: [] };
  }

  const moduleIds = new Set<string>();
  const lessonIds = new Set<string>();
  for (const instruction of instructions) {
    switch (instruction.op) {
      case 'module':
        moduleIds.add(instruction.moduleId);
        break;
      case 'lesson-content':
      case 'lesson-questions':
        lessonIds.add(instruction.lessonId);
        break;
      case 'question':
        if (instruction.moduleId != null) {
          // Module-test questions live only in the module doc.
          moduleIds.add(instruction.moduleId);
        } else if (instruction.lessonId != null) {
          lessonIds.add(instruction.lessonId);
        }
        break;
      default:
        // Unknown op from a newer manifest schema — refetch everything rather
        // than guessing.
        return { full: true, moduleIds: [], lessonIds: [] };
    }
  }
  for (const lessonId of [...lessonIds]) {
    const owner = lessonOwner.get(lessonId);
    if (owner != null && moduleIds.has(owner)) {
      lessonIds.delete(lessonId);
    }
  }
  return { full: false, moduleIds: [...moduleIds], lessonIds: [...lessonIds] };
};

const SEVERITY_RANK: Record<UpdateSeverity, number> = {
  soft: 0,
  optional: 1,
  hard: 2,
};

const DEFAULT_HARD_MESSAGE =
  'We are sorry — some course content had to be corrected. The affected ' +
  'lessons and module tests were reset and need to be retaken.';
const DEFAULT_OPTIONAL_MESSAGE =
  'Some course content was updated. You can retake the affected parts to be ' +
  'safe, or keep your progress as it is.';

// Progress keys an instruction invalidates, restricted to keys that actually
// exist (not-started scopes are silent by requirement, and with the
// authoritative pull the local keys mirror the server rows).
const scopeFor = (
  instruction: UpdateInstructionV2,
  progress: ProgressKeys,
  newBundle: CourseBundleV2,
): ScopeReset => {
  switch (instruction.op) {
    case 'lesson-content':
    case 'lesson-questions':
      return {
        lessonIds: progress.lessonIds.filter(id => id === instruction.lessonId),
        topicIds: [],
      };
    case 'question':
      if (instruction.moduleId != null) {
        return {
          lessonIds: [],
          topicIds: progress.topicIds.filter(id => id === instruction.moduleId),
        };
      }
      return {
        lessonIds: progress.lessonIds.filter(id => id === instruction.lessonId),
        topicIds: [],
      };
    case 'module': {
      const moduleLessonIds = new Set(
        newBundle.modules
          .find(module => module.moduleId === instruction.moduleId)
          ?.lessons.map(lesson => lesson.lessonId) ?? [],
      );
      return {
        lessonIds: progress.lessonIds.filter(id => moduleLessonIds.has(id)),
        topicIds: progress.topicIds.filter(id => id === instruction.moduleId),
      };
    }
    case 'full':
      return {
        lessonIds: progress.lessonIds.filter(id =>
          id.startsWith(COURSE_PROGRESS_PREFIX),
        ),
        topicIds: progress.topicIds.filter(id =>
          id.startsWith(COURSE_PROGRESS_PREFIX),
        ),
      };
  }
};

const isEmptyScope = (scope: ScopeReset): boolean =>
  scope.lessonIds.length === 0 && scope.topicIds.length === 0;

const unionScopes = (scopes: ScopeReset[]): ScopeReset => ({
  lessonIds: [...new Set(scopes.flatMap(scope => scope.lessonIds))],
  topicIds: [...new Set(scopes.flatMap(scope => scope.topicIds))],
});

// Aggregates all traversed instructions into at most ONE prompt carrying the
// worst-case message: any hard-affected started scope → a single apology
// (hard resets already applied, optional scopes keep their progress);
// otherwise optional scopes → a single keep-or-redo choice.
export const planProgressActions = (
  userId: string,
  instructions: UpdateInstructionV2[],
  progress: ProgressKeys,
  newBundle: CourseBundleV2,
): ProgressPlan => {
  const hardScopes: ScopeReset[] = [];
  const optionalScopes: ScopeReset[] = [];
  let hardMessage: string | null = null;
  let optionalMessage: string | null = null;

  for (const instruction of instructions) {
    if (SEVERITY_RANK[instruction.severity] == null) {
      continue;
    }
    const scope = scopeFor(instruction, progress, newBundle);
    if (isEmptyScope(scope)) {
      continue;
    }
    if (instruction.severity === 'hard') {
      hardScopes.push(scope);
      hardMessage = hardMessage ?? instruction.message ?? null;
    } else if (instruction.severity === 'optional') {
      optionalScopes.push(scope);
      optionalMessage = optionalMessage ?? instruction.message ?? null;
    }
  }

  if (hardScopes.length > 0) {
    return {
      hardResets: unionScopes(hardScopes),
      prompt: {
        userId,
        kind: 'hard',
        message: hardMessage ?? DEFAULT_HARD_MESSAGE,
        optionalReset: { lessonIds: [], topicIds: [] },
      },
    };
  }
  if (optionalScopes.length > 0) {
    return {
      hardResets: { lessonIds: [], topicIds: [] },
      prompt: {
        userId,
        kind: 'optional',
        message: optionalMessage ?? DEFAULT_OPTIONAL_MESSAGE,
        optionalReset: unionScopes(optionalScopes),
      },
    };
  }
  return { hardResets: { lessonIds: [], topicIds: [] }, prompt: null };
};
