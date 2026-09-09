import type {
  CardStyleV2,
  CourseAssetV2,
  CourseQuestionV2,
  LessonBlockV2,
  LessonDocV2,
  LessonElementV2,
} from '@/data/course/v2/wire';

// Shapes the admin API returns. The document types themselves come from the
// app's wire format, so the panel and the player can never disagree on them.

// Where a release can be served from: staging for a device in dev mode,
// production for everyone.
export type Channel = 'staging' | 'production';

export type ChannelPointers = {
  staging: string | null;
  production: string | null;
};

export type ChannelState = {
  version: string;
  updatedAt: string;
  updatedBy: string;
} | null;

export type ChannelMove = {
  channel: Channel;
  from: string | null;
  to: string;
  actor: string;
  reason: string;
  at: string;
};

export type CourseSummary = {
  courseId: string;
  usState: string;
  latestVersion: string;
  channels: ChannelPointers;
};

// The signs catalogue has no version numbers: a snapshot is named by the
// sha256 of its document.
export type SignsSnapshot = {
  sha256: string;
  sizeBytes: number;
  updatedAt: string;
} | null;

// The published question bank: one live document per course, addressed by
// the sha256 of its own bytes — the same shape the signs catalogue has.
// A picture a bank question shows. Same shape as a course asset minus the
// uuid, which only the course documents carry.
export type BankAsset = {
  assetId: string;
  mime: string;
  sha256: string;
  sizeBytes: number;
  width: number;
  height: number;
  alt: string;
};

export type QuestionBankDoc = {
  schemaVersion: number;
  courseId: string;
  questions: CourseQuestionV2[];
  // The pictures those questions show. Absent in a bank published before
  // artwork travelled with it.
  assets?: BankAsset[];
};

export type BankSnapshot = {
  sha256: string;
  sizeBytes: number;
  updatedAt: string;
} | null;

export type BankChannels = {
  staging: BankSnapshot;
  production: BankSnapshot;
  // The saved working document, which is what the editor shows. Different
  // from production means edits nobody has published yet.
  working: BankSnapshot;
};

export type SignsChannels = {
  staging: SignsSnapshot;
  production: SignsSnapshot;
};

export type PlatformRelease = {
  latestVersion: string;
  storeUrl: string;
};

export type AppReleaseSettings = {
  minSupportedAppVersion: string;
  ios: PlatformRelease;
  android: PlatformRelease;
  updatedAt: string;
  updatedBy: string;
};

export type AppReleasePatch = {
  minSupportedAppVersion?: string;
  ios?: Partial<PlatformRelease>;
  android?: Partial<PlatformRelease>;
};

export type LlmProvider = {
  id: 'anthropic' | 'openai';
  configured: boolean;
  models: string[];
};

export type AdminSettings = {
  courseName: string;
  defaultState: string;
  autoBump: boolean;
  requireChangeNote: boolean;
  reviewBeforeRelease: boolean;
  diffOnByDefault: boolean;
  autosaveDrafts: boolean;
  spellCheck: boolean;
  llmProvider: LlmProvider['id'];
  llmModel: string;
};

export type Workspace = {
  courses: CourseSummary[];
  settings: AdminSettings;
  llm: { providers: LlmProvider[] };
};

export type ReleasedVersion = {
  version: string;
  releasedAt: string;
  status: string;
  notes: string;
  minAppVersion: string;
  channels: Channel[];
};

export type DraftInfo = {
  draftId: string;
  courseId: string;
  versionLabel: string;
  baseVersion: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type VersionsResponse = {
  courseId: string;
  latestVersion: string;
  channels: ChannelPointers;
  released: ReleasedVersion[];
  drafts: DraftInfo[];
};

export type OutlineLesson = {
  lessonId: string;
  title: string;
  estimatedMinutes: string;
  cardCount: number;
  questionCount: number;
  number?: number;
};

export type OutlineModule = {
  moduleId: string;
  title: string;
  sequence: number;
  moduleTestQuestionCount: number;
  moduleTestQuestionIds: string[];
  lessons: OutlineLesson[];
};

export type Outline = {
  courseId: string;
  version: string;
  format: 'cards';
  title: string;
  state: string;
  // The course's authored slide types. Released and competitor outlines send
  // an empty list rather than omitting the field.
  cardStyles: CardStyleV2[];
  modules: OutlineModule[];
};

export type BankQuestion = CourseQuestionV2 & { lessonId: string | null };

export type CompetitorImage = {
  src: string;
  alt: string;
  caption?: string;
  description?: string;
};

export type CompetitorSection = {
  heading?: string;
  level: 2 | 3;
  paragraphs: string[];
  images: CompetitorImage[];
  bullets: string[];
  stateNotes: string[];
  takeaways: string[];
  californiaSpecific: boolean;
};

export type CompetitorQuestion = {
  number: number;
  prompt: string;
  image?: CompetitorImage;
  options: { letter: string; text: string }[];
  correctLetter: string | null;
  correctText: string | null;
};

export type CompetitorLesson = {
  lessonId: string;
  title: string;
  sequence: number;
  sections: CompetitorSection[];
  test?: { questions: CompetitorQuestion[] };
};

export type CompetitorSummary = {
  id: string;
  name: string;
  format: 'article' | 'slides';
  modules: number;
  lessons: number;
};

export type UpdateSeverity = 'hard' | 'optional' | 'soft';

export type UpdateInstruction = {
  op: 'lesson-content' | 'lesson-questions' | 'question' | 'module' | 'full';
  lessonId?: string;
  moduleId?: string;
  questionId?: string;
  severity: UpdateSeverity;
  message?: string;
};

export type DraftDiff = {
  baseVersion: string;
  // Releases between the base and the newest one; a fork from an older
  // release accounts for what differs from each of them.
  skippedReleases: string[];
  // The minimum app build this release inherits if it is not changed.
  baseMinAppVersion: string;
  suggestedBump: 'none' | 'patch' | 'minor' | 'major';
  suggestedVersion: string;
  courseStructureChanged: boolean;
  modules: {
    moduleId: string;
    metaChanged: boolean;
    lessonListChanged: boolean;
    testChanged: boolean;
    added: boolean;
    removed: boolean;
  }[];
  lessons: {
    lessonId: string;
    moduleId: string;
    contentChanged: boolean;
    questionsChanged: boolean;
    added: boolean;
    removed: boolean;
  }[];
  suggestedInstructions: UpdateInstruction[];
};

export type StructureOp =
  | { kind: 'module-move'; moduleId: string; direction: -1 | 1 }
  | { kind: 'module-rename'; moduleId: string; title: string }
  | { kind: 'module-add'; title: string }
  | {
      kind: 'lesson-move';
      moduleId: string;
      lessonId: string;
      direction: -1 | 1;
    }
  | { kind: 'lesson-rename'; lessonId: string; title: string }
  | { kind: 'lesson-add'; moduleId: string; title: string }
  | { kind: 'lesson-move-to'; lessonId: string; moduleId: string }
  | { kind: 'lesson-delete'; lessonId: string }
  | { kind: 'module-delete'; moduleId: string };

export type {
  CardStyleV2,
  CourseAssetV2,
  CourseQuestionV2,
  LessonBlockV2,
  LessonDocV2,
  LessonElementV2,
};

// ---------------------------------------------------------------------------
// Signs — the wire contract is re-exported from the app so panel and player
// cannot disagree; the admin-only response shapes mirror server/src/admin/
// signsAdmin.ts.

export type {
  Sign,
  SignCategory,
  SignCategoryGlyph,
  SignImage,
  SignImageMime,
  SignImageRef,
  SignsDoc,
} from '@/data/signs/wire';

// ---------------------------------------------------------------------------
// The universal skeleton, read-only. Mirrors server/src/admin/skeleton.ts: the
// shared lessons every state's course is built from, with each state's notes
// shown where they attach and the state module filled in per state.

export type SkeletonCard =
  | {
      kind: 'card';
      type: string;
      title: string;
      lines: string[];
      bullets?: string[];
      anchor: string;
      conceptId: string;
    }
  | { kind: 'image'; assetId: string; anchor: string }
  | {
      kind: 'recall';
      context: string;
      ruleMarkdown: string;
      anchor: string;
      conceptId: string;
    };

export type SkeletonQuestion = {
  prompt?: string;
  choices?: string[];
  correct?: number;
  explanation: string;
  numeric?: { param: string; unit: string; offsets: number[] };
  image?: string;
};

export type SkeletonBlock = {
  scope: 'universal' | 'state_specific';
  card: SkeletonCard;
  stateCode?: string;
  after?: string;
  rules?: string[];
  image?: string;
};

export type SkeletonViewLesson = {
  id: string;
  title: string;
  objective: string;
  keyPoints: string[];
  conceptId: string;
  challenge: SkeletonQuestion & { scenario: string };
  blocks: SkeletonBlock[];
  test: SkeletonQuestion[];
  stateCode?: string;
};

export type SkeletonViewModule = {
  id: string;
  title: string;
  outcome: string;
  scope: 'universal' | 'state_specific';
  lessons: SkeletonViewLesson[];
};

export type SkeletonAsset = {
  alt: string;
  width: number;
  height: number;
  numbers?: string[];
};

export type SkeletonView = {
  revision: string;
  skeletonVersion: string;
  modules: SkeletonViewModule[];
  assets: Record<string, SkeletonAsset>;
  states: {
    stateCode: string;
    courseId: string;
    name: string;
    sourceVersionLabel: string;
  }[];
  counts: {
    universalLessons: number;
    universalCards: number;
    stateNotes: number;
    stateLessons: number;
    parameters: number;
  };
};

export type ParameterEntry = {
  key: string;
  uses: { lessonId: string; where: string }[];
  states: {
    stateCode: string;
    defined: boolean;
    value: string | number | null;
    rule: string | null;
    status: string | null;
  }[];
};

export type ParameterCatalogue = {
  revision: string;
  skeletonVersion: string;
  states: { stateCode: string; name: string; courseId: string }[];
  parameters: ParameterEntry[];
  unusedByState: { stateCode: string; keys: string[] }[];
};
