import { api } from './client';
import type {
  AdminSettings,
  AppReleasePatch,
  AppReleaseSettings,
  Channel,
  ChannelMove,
  ChannelState,
  SignImageRef,
  SignsChannels,
  SignsDoc,
  BankChannels,
  BankQuestion,
  CardStyleV2,
  CourseAssetV2,
  CourseQuestionV2,
  CompetitorLesson,
  CompetitorSummary,
  DraftDiff,
  UpdateInstruction,
  DraftInfo,
  LessonDocV2,
  AuthoringRevision,
  AuthoringStatus,
  CardPatch,
  Outline,
  ParameterCatalogue,
  QuestionBankDoc,
  QuestionPatch,
  SkeletonView,
  GenerateResult,
  StateOrigins,
  StateParamValue,
  TrainStatus,
  StructureOp,
  VersionsResponse,
  Workspace,
} from './types';

const enc = encodeURIComponent;

export const adminApi = {
  workspace: () => api.get<Workspace>('/workspace'),

  // The universal skeleton and its parameter catalogue. Read-only: the panel
  // shows what every state's course is built from; editing it is a later step.
  skeleton: () => api.get<SkeletonView>('/skeleton'),

  skeletonParameters: () => api.get<ParameterCatalogue>('/skeleton/parameters'),

  skeletonStatus: () => api.get<AuthoringStatus>('/skeleton/status'),

  train: () => api.get<TrainStatus>('/train'),

  // All members or none. A refusal comes back as a 400/409 carrying one line
  // per reason, which is what the panel shows instead of a version number.
  generateTrain: (body: {
    bump?: 'patch' | 'minor' | 'major';
    notes?: string;
    message?: string;
    dryRun?: boolean;
  }) => api.post<GenerateResult>('/train/generate', body),

  publishTrainStaging: (version: string, reason: string) =>
    api.post<{ channel: string; version: string }>('/train/publish', {
      version,
      reason,
    }),

  skeletonRevisions: (subject: string) =>
    api.get<{ subject: string; revisions: AuthoringRevision[] }>(
      `/skeleton/revisions?subject=${enc(subject)}`,
    ),

  skeletonRevision: (subject: string, revision: number) =>
    api.get<SkeletonView>(
      `/skeleton/revisions/${revision}?subject=${enc(subject)}`,
    ),

  cutSkeletonRevision: (subject: string, message: string) =>
    api.post<AuthoringRevision>('/skeleton/revisions', { subject, message }),

  restoreSkeletonRevision: (subject: string, revision: number) =>
    api.post<{ restored: number }>('/skeleton/restore', { subject, revision }),

  exportAuthoring: () => api.post<{ written: string[] }>('/skeleton/export'),

  // The skeleton itself: an edit here reaches every state.
  saveSkeletonCard: (anchor: string, patch: CardPatch) =>
    api.put<{ anchor: string }>(`/skeleton/cards/${enc(anchor)}`, patch),

  saveSkeletonQuestion: (questionId: string, patch: QuestionPatch) =>
    api.put<{ questionId: string }>(
      `/skeleton/questions/${enc(questionId)}`,
      patch,
    ),

  // One state's own: an override on a shared card, or a note or state lesson
  // the state owns outright. The server decides which by what the anchor names.
  saveStateCard: (stateCode: string, anchor: string, patch: CardPatch) =>
    api.put<{ stateCode: string; anchor: string; wrote: string }>(
      `/skeleton/states/${enc(stateCode)}/cards/${enc(anchor)}`,
      patch,
    ),

  revertStateCard: (stateCode: string, anchor: string) =>
    api.delete<{ wrote: string }>(
      `/skeleton/states/${enc(stateCode)}/cards/${enc(anchor)}`,
    ),

  saveStateQuestion: (
    stateCode: string,
    questionId: string,
    patch: QuestionPatch,
  ) =>
    api.put<{ stateCode: string }>(
      `/skeleton/states/${enc(stateCode)}/questions/${enc(questionId)}`,
      patch,
    ),

  revertStateQuestion: (stateCode: string, questionId: string) =>
    api.delete<{ wrote: string }>(
      `/skeleton/states/${enc(stateCode)}/questions/${enc(questionId)}`,
    ),

  promoteToSkeleton: (
    stateCode: string,
    kind: 'card' | 'question',
    target: string,
  ) =>
    api.post<{ promoted: string }>(
      `/skeleton/states/${enc(stateCode)}/promote`,
      { kind, target },
    ),

  stateOrigins: (stateCode: string) =>
    api.get<StateOrigins>(`/skeleton/states/${enc(stateCode)}/origins`),

  saveStateParam: (stateCode: string, key: string, param: StateParamValue) =>
    api.put<{ key: string; param: StateParamValue }>(
      `/skeleton/states/${enc(stateCode)}/params/${enc(key)}`,
      param,
    ),

  saveSettings: (patch: Partial<AdminSettings>) =>
    api.put<AdminSettings>('/settings', patch),

  versions: (courseId: string) =>
    api.get<VersionsResponse>(`/courses/${enc(courseId)}/versions`),

  releasedOutline: (courseId: string, version: string) =>
    api.get<Outline>(
      `/courses/${enc(courseId)}/released/${enc(version)}/outline`,
    ),

  releasedLesson: (courseId: string, version: string, lessonId: string) =>
    api.get<LessonDocV2>(
      `/courses/${enc(courseId)}/released/${enc(version)}/lessons/${enc(
        lessonId,
      )}`,
    ),

  draftOutline: (courseId: string, draftId: string) =>
    api.get<Outline>(
      `/courses/${enc(courseId)}/drafts/${enc(draftId)}/outline`,
    ),

  draftLesson: (courseId: string, draftId: string, lessonId: string) =>
    api.get<LessonDocV2>(
      `/courses/${enc(courseId)}/drafts/${enc(draftId)}/lessons/${enc(
        lessonId,
      )}`,
    ),

  saveDraftLesson: (
    courseId: string,
    draftId: string,
    lessonId: string,
    lesson: LessonDocV2,
  ) =>
    api.put<DraftInfo>(
      `/courses/${enc(courseId)}/drafts/${enc(draftId)}/lessons/${enc(
        lessonId,
      )}`,
      { lesson },
    ),

  createDraft: (courseId: string, baseVersion: string, versionLabel?: string) =>
    api.post<DraftInfo>(`/courses/${enc(courseId)}/drafts`, {
      baseVersion,
      versionLabel,
    }),

  nextVersion: (courseId: string, base: string) =>
    api.get<{ suggested: string }>(
      `/courses/${enc(courseId)}/next-version?base=${enc(base)}`,
    ),

  deleteDraft: (courseId: string, draftId: string) =>
    api.delete<{ ok: true }>(
      `/courses/${enc(courseId)}/drafts/${enc(draftId)}`,
    ),

  structure: (courseId: string, draftId: string, op: StructureOp) =>
    api.post<Outline>(
      `/courses/${enc(courseId)}/drafts/${enc(draftId)}/structure`,
      op,
    ),

  questions: (courseId: string, draftId: string, moduleId?: string) =>
    api.get<{ questions: BankQuestion[]; assets?: CourseAssetV2[] }>(
      `/courses/${enc(courseId)}/drafts/${enc(draftId)}/questions${
        moduleId == null ? '' : `?moduleId=${enc(moduleId)}`
      }`,
    ),

  saveQuestion: (
    courseId: string,
    draftId: string,
    question: CourseQuestionV2,
  ) =>
    api.put<DraftInfo>(
      `/courses/${enc(courseId)}/drafts/${enc(draftId)}/questions/${enc(
        question.questionId,
      )}`,
      { question },
    ),

  // Slide types are course-wide, so the editor always writes the whole list.
  saveCardStyles: (
    courseId: string,
    draftId: string,
    cardStyles: CardStyleV2[],
  ) =>
    api.put<DraftInfo>(
      `/courses/${enc(courseId)}/drafts/${enc(draftId)}/card-styles`,
      { cardStyles },
    ),

  draftDiff: (courseId: string, draftId: string) =>
    api.get<DraftDiff>(`/courses/${enc(courseId)}/drafts/${enc(draftId)}/diff`),

  release: (
    courseId: string,
    draftId: string,
    payload: {
      version: string;
      notes: string;
      minAppVersion?: string;
      adoption?: 'auto' | 'opt_in';
      // Legacy-only; the current app never reads them.
      instructions?: UpdateInstruction[];
      updateKind?: 'fix' | 'course';
      updateSubtype?: 'silent' | 'apology' | 'rules' | 'new_users' | 'offer';
      updateMessage?: string;
    },
  ) =>
    api.post<{ version: string }>(
      `/courses/${enc(courseId)}/drafts/${enc(draftId)}/release`,
      payload,
    ),

  // Publishing points a channel at a released version; rolling back is the
  // same move to an older one. Nothing is deployed.
  channels: (courseId: string) =>
    api.get<Record<Channel, ChannelState>>(
      `/courses/${enc(courseId)}/channels`,
    ),

  publishChannel: (
    courseId: string,
    channel: Channel,
    version: string,
    reason?: string,
  ) =>
    api.post<ChannelMove>(
      `/courses/${enc(courseId)}/channels/${channel}/publish`,
      { version, reason },
    ),

  channelHistory: (courseId: string, limit = 20) =>
    api.get<{ moves: ChannelMove[] }>(
      `/courses/${enc(courseId)}/channels/history?limit=${limit}`,
    ),

  appRelease: () => api.get<AppReleaseSettings>('/app-release'),

  saveAppRelease: (patch: AppReleasePatch) =>
    api.put<AppReleaseSettings>('/app-release', patch),

  competitors: () => api.get<{ courses: CompetitorSummary[] }>('/competitors'),

  competitorOutline: (id: string) =>
    api.get<Outline>(`/competitors/${enc(id)}/outline`),

  competitorLesson: (id: string, lessonId: string) =>
    api.get<CompetitorLesson>(
      `/competitors/${enc(id)}/lessons/${enc(lessonId)}`,
    ),

  setModuleTest: (
    courseId: string,
    draftId: string,
    moduleId: string,
    questionIds: string[],
  ) =>
    api.put<DraftInfo>(
      `/courses/${enc(courseId)}/drafts/${enc(draftId)}/modules/${enc(
        moduleId,
      )}/test`,
      { questionIds },
    ),

  // The published question bank, per course. Unlike a draft's pool this is
  // what devices actually download, so it is edited and published on its own
  // terms — like the signs catalogue, and for the same reason: a question fix
  // has nothing to do with a course release.
  bankDoc: (courseId: string) =>
    api.get<QuestionBankDoc>(`/bank/${enc(courseId)}/doc`),

  saveBankDoc: (courseId: string, doc: QuestionBankDoc) =>
    api.put<{ ok: true }>(`/bank/${enc(courseId)}/doc`, { doc }),

  bankChannels: (courseId: string) =>
    api.get<BankChannels>(`/bank/${enc(courseId)}/channels`),

  publishBank: (courseId: string, channel: Channel, sha256?: string) =>
    api.post<ChannelMove>(
      `/bank/${enc(courseId)}/channels/${channel}/publish`,
      {
        sha256,
      },
    ),

  bankHistory: (courseId: string, limit = 20) =>
    api.get<{ moves: ChannelMove[] }>(
      `/bank/${enc(courseId)}/channels/history?limit=${limit}`,
    ),

  signsDoc: () => api.get<SignsDoc>('/signs/doc'),

  saveSignsDoc: (doc: SignsDoc) => api.put<{ ok: true }>('/signs/doc', { doc }),

  // Multipart, so it bypasses the JSON client: the server hashes the bytes and
  // returns the reference the document must carry. One endpoint for every kind
  // of artwork — a file named by its own hash belongs to whoever points at it.
  uploadAsset: (file: File) => api.upload<SignImageRef>('/assets', file),

  uploadSignAsset: (file: File) =>
    api.upload<SignImageRef>('/signs/assets', file),

  signsChannels: () => api.get<SignsChannels>('/signs/channels'),

  // Staging snapshots the working document; production names a snapshot that
  // has already been on staging, which is also how a rollback is expressed.
  publishSigns: (channel: Channel, sha256?: string) =>
    api.post<ChannelMove>(`/signs/channels/${channel}/publish`, { sha256 }),

  signsHistory: (limit = 20) =>
    api.get<{ moves: ChannelMove[] }>(`/signs/channels/history?limit=${limit}`),
};
