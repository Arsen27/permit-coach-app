import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert } from 'react-native';
import { ThemeProvider } from 'styled-components/native';

import { courseIdForState } from '@/data/course';
import { courseStore } from '@/data/course/store';
import { installCourse } from '@/data/course/updater';
import { COURSE_SCHEMA_VERSION } from '@/data/course/v2/wire';
import type { CourseDocV2, ModuleDocV2 } from '@/data/course/v2/wire';
import {
  SUPPORTED_STATES_FALLBACK,
  loadStates,
  resetStatesForTests,
} from '@/data/states';
import StatePickerScreen from '@/screens/StatePickerScreen';
import { AppStateProvider, useAppState } from '@/state/AppState';
import { buildPushPayload, mergeRemoteIntoLocal } from '@/sync/merge';
import { emptyPending, markPending } from '@/sync/types';
import { defaultTheme } from '@/theme';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn() }),
}));

// The download itself is the updater's business (covered in
// courseUpdater.test.ts); here it is a switch the test flips per case.
jest.mock('@/data/course/updater', () => ({
  installCourse: jest.fn(),
}));
const mockInstall = installCourse as jest.MockedFunction<typeof installCourse>;

// A minimal committed course per state, so the picker sees "already on the
// phone" for some states and "needs a download" for others.
const moduleDoc = (courseId: string, version: string): ModuleDocV2 => ({
  schemaVersion: COURSE_SCHEMA_VERSION,
  deliveryVersion: version,
  module: {
    moduleId: `${courseId}-m1`,
    uuid: '00000000-0000-5000-8000-2000000000ff',
    sequence: 1,
    title: 'Module one',
    outcome: '',
    lessons: [],
    moduleTest: {
      testId: `${courseId}-m1-test`,
      uuid: '00000000-0000-5000-8000-3000000000ff',
      moduleId: `${courseId}-m1`,
      questionIds: [],
    },
  },
  questions: [],
  assets: [],
});

const courseDoc = (
  courseId: string,
  jurisdiction: string,
  state: string,
  version: string,
): CourseDocV2 => ({
  schemaVersion: COURSE_SCHEMA_VERSION,
  deliveryVersion: version,
  course: {
    courseId,
    title: `${state} course`,
    subtitle: 's',
    jurisdiction,
    state,
    language: 'en-US',
    targetLicense: 'x',
    moduleIds: [`${courseId}-m1`],
    sourceVersionLabel: 'TEST',
    sourceContentHash: 'h'.repeat(64),
    sourceCheckedAt: '2026-08-10',
    sourceReviewStatus: 'draft_generated_human_review_required',
    publicationAuthorized: false,
  },
});

const commitCourse = (
  courseId: string,
  jurisdiction: string,
  state: string,
  version = '1.0.0',
) =>
  courseStore.commit(
    version,
    courseDoc(courseId, jurisdiction, state, version),
    [moduleDoc(courseId, version)],
  );

// What a real download leaves behind: the course committed into its slot.
const installSucceeds = () =>
  mockInstall.mockImplementation(async ({ courseId, onProgress }) => {
    onProgress?.({ fetched: 1, total: 2 });
    const state =
      courseId === 'fl-class-e'
        ? ['FL', 'Florida']
        : courseId === 'tx-class-c'
        ? ['TX', 'Texas']
        : ['CA', 'California'];
    await commitCourse(courseId, state[0], state[1]);
    onProgress?.({ fetched: 2, total: 2 });
    return { status: 'installed' };
  });

let observedState: ReturnType<typeof useAppState> | null = null;
const Probe: React.FC = () => {
  observedState = useAppState();
  return null;
};

const renderPicker = async () => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <ThemeProvider theme={defaultTheme}>
        <AppStateProvider userId="test-user">
          <Probe />
          <StatePickerScreen
            navigation={{ goBack: mockGoBack } as never}
            route={{ key: 's', name: 'StatePicker' } as never}
          />
        </AppStateProvider>
      </ThemeProvider>,
    );
  });
  return tree;
};

const textsOf = (tree: ReactTestRenderer.ReactTestRenderer): string[] =>
  tree.root
    .findAll(node => String(node.type) === 'Text')
    .flatMap(t => t.children.filter(c => typeof c === 'string') as string[]);

const pressWithText = async (
  tree: ReactTestRenderer.ReactTestRenderer,
  name: string,
) => {
  const rows = tree.root.findAll(node => {
    if (typeof node.type === 'string' || node.props.onPress == null) {
      return false;
    }
    return node
      .findAll(inner => String(inner.type) === 'Text')
      .flatMap(t => t.children.filter(c => typeof c === 'string'))
      .join(' ')
      .includes(name);
  });
  await ReactTestRenderer.act(async () => {
    rows[rows.length - 1].props.onPress();
  });
};

// The confirm alert's destructive handler is async (it asks the store first);
// give it a tick to settle.
const settle = () =>
  ReactTestRenderer.act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });

const confirmSwitches = () =>
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
    buttons?.find(button => button.style === 'destructive')?.onPress?.();
  });

beforeEach(async () => {
  const AsyncStorage =
    require('@react-native-async-storage/async-storage').default;
  await AsyncStorage.clear();
  courseStore.resetForTests();
  observedState = null;
  mockGoBack.mockClear();
  mockInstall.mockReset();
  jest.restoreAllMocks();
  // The states list is fetched once per launch and cached in the module; a
  // test that saw one server answer must not hand it to the next.
  // The states list is the server's and is fetched once per launch; these
  // tests are about switching, so it answers with the three states they were
  // written against, settled before anything renders.
  resetStatesForTests();
  globalThis.fetch = (async () =>
    ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          states: SUPPORTED_STATES_FALLBACK.map(state => ({
            stateCode: state.code,
            name: state.name,
            courseId: state.courseId,
            domain: state.domain,
          })),
        }),
    } as Response)) as typeof fetch;
  await loadStates();
  // Every device in these tests already holds the course it is on.
  await commitCourse('ca-class-c', 'CA', 'California');
});

describe('the picker when the list cannot be fetched', () => {
  it('says there is no connection and offers a retry', async () => {
    resetStatesForTests();
    globalThis.fetch = (async () => {
      throw new TypeError('Network request failed');
    }) as typeof fetch;
    await loadStates();
    const tree = await renderPicker();
    const texts = textsOf(tree);
    expect(texts).toContain('No connection');
    expect(texts).toContain('Try again');
    // The states the binary carries are still offered — a picker with
    // nothing in it would be worse than one that may be incomplete.
    expect(texts).toEqual(expect.arrayContaining(['California', 'Texas']));
  });

  it("says nothing about connectivity once the list is the server's", async () => {
    resetStatesForTests();
    globalThis.fetch = (async () =>
      ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            states: [
              {
                stateCode: 'CA',
                name: 'California',
                courseId: 'ca-class-c',
                domain: 'dmv.ca.gov',
              },
              {
                stateCode: 'NY',
                name: 'New York',
                courseId: 'ny-class-d',
                domain: 'dmv.ny.gov',
              },
            ],
          }),
      } as Response)) as typeof fetch;
    await loadStates();
    const tree = await renderPicker();
    const texts = textsOf(tree);
    expect(texts).not.toContain('No connection');
    // A state added on the server, in a build that never heard of it.
    expect(texts).toContain('New York');
  });
});

describe('course selection by state', () => {
  it('maps the states the binary carries to their courses', () => {
    // The list is the server's; these three are the floor a first launch
    // with no network falls back to.
    expect(SUPPORTED_STATES_FALLBACK.map(state => state.code)).toEqual([
      'CA',
      'FL',
      'TX',
    ]);
    expect(courseIdForState('CA')).toBe('ca-class-c');
    expect(courseIdForState('FL')).toBe('fl-class-e');
    expect(courseIdForState('TX')).toBe('tx-class-c');
    // A state this build has never heard of falls back rather than crash.
    expect(courseIdForState('NY')).toBe('ca-class-c');
  });

  it('switches the served bundle between downloaded courses', async () => {
    await commitCourse('fl-class-e', 'FL', 'Florida');
    expect(courseStore.getSnapshot()!.bundle.course.courseId).toBe(
      'ca-class-c',
    );
    courseStore.setActiveCourse('fl-class-e');
    expect(courseStore.getSnapshot()!.bundle.course.state).toBe('Florida');
    // A state whose course was never downloaded has nothing to serve.
    courseStore.setActiveCourse('tx-class-c');
    expect(courseStore.getSnapshot()).toBeNull();
  });
});

describe('switching state in settings', () => {
  it('lists only the three supported states', async () => {
    const tree = await renderPicker();
    const texts = textsOf(tree);
    expect(texts).toEqual(
      expect.arrayContaining(['California', 'Florida', 'Texas']),
    );
    expect(texts).not.toContain('New York');
  });

  it('warns even when there is no progress yet', async () => {
    const alertSpy = confirmSwitches();
    installSucceeds();
    const tree = await renderPicker();
    await pressWithText(tree, 'Florida');
    await settle();

    expect(alertSpy).toHaveBeenCalledWith(
      'Switch to Florida?',
      expect.stringContaining('permanently erased'),
      expect.anything(),
    );
  });

  it('closes without an alert when re-picking the current state', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const tree = await renderPicker();
    await pressWithText(tree, 'California');

    expect(alertSpy).not.toHaveBeenCalled();
    expect(observedState!.user.stateCode).toBe('CA');
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('downloads the new course first, then switches and wipes progress', async () => {
    confirmSwitches();
    installSucceeds();
    const tree = await renderPicker();
    await ReactTestRenderer.act(async () => {
      observedState!.applyTopicResult('road-signs', 80);
      observedState!.applyExamResult(72);
      observedState!.recordQuestionAnswer('q1', true);
      observedState!.recordMistake('q2');
      observedState!.toggleSavedQuestion('q3');
      observedState!.toggleSavedSign('sign-1');
    });

    await pressWithText(tree, 'Texas');
    await settle();

    // The sheet went up for the download, and nothing switched until it
    // landed.
    expect(mockInstall).toHaveBeenCalledWith(
      expect.objectContaining({ courseId: 'tx-class-c' }),
    );
    expect(textsOf(tree)).toContain('Course ready');
    expect(observedState!.user.stateCode).toBe('CA');
    expect(courseStore.activeCourseId()).toBe('ca-class-c');

    // The confirmation holds for a beat (real time: the screen's own
    // timer), then the switch goes through.
    await ReactTestRenderer.act(async () => {
      await new Promise(resolve => setTimeout(resolve, 1200));
    });

    expect(observedState!.user.stateCode).toBe('TX');
    expect(courseStore.activeCourseId()).toBe('tx-class-c');
    expect(courseStore.getSnapshot()!.bundle.course.state).toBe('Texas');
    expect(mockGoBack).toHaveBeenCalled();
    expect(observedState!.topicScores).toEqual({});
    expect(observedState!.bestExam).toBeNull();
    expect(observedState!.questionStats).toEqual({});
    expect(observedState!.mistakeIds).toEqual([]);
    expect(observedState!.savedQuestionIds).toEqual([]);
    // The streak and saved signs are not course progress.
    expect(observedState!.savedSignIds).toEqual(['sign-1']);
  });

  it('switches straight away to a course already on the phone', async () => {
    confirmSwitches();
    await commitCourse('fl-class-e', 'FL', 'Florida');
    const tree = await renderPicker();
    await pressWithText(tree, 'Florida');
    await settle();

    expect(mockInstall).not.toHaveBeenCalled();
    expect(observedState!.user.stateCode).toBe('FL');
    expect(courseStore.activeCourseId()).toBe('fl-class-e');
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('keeps the old state when the download cannot start offline', async () => {
    confirmSwitches();
    mockInstall.mockResolvedValue({ status: 'offline' });
    const tree = await renderPicker();
    await pressWithText(tree, 'Texas');
    await settle();

    const texts = textsOf(tree);
    expect(texts).toContain("You're offline");
    expect(texts.join(' ')).toContain('needs an internet connection');
    expect(texts.join(' ')).toContain('everything works offline');
    expect(observedState!.user.stateCode).toBe('CA');
    expect(courseStore.activeCourseId()).toBe('ca-class-c');
    expect(mockGoBack).not.toHaveBeenCalled();

    // Cancel walks away with nothing changed…
    await pressWithText(tree, 'Cancel');
    expect(textsOf(tree)).not.toContain("You're offline");
    expect(observedState!.user.stateCode).toBe('CA');

    // …and a retry after reconnecting goes through the same download.
    await pressWithText(tree, 'Texas');
    await settle();
    expect(mockInstall).toHaveBeenCalledTimes(2);
  });

  it('offers a retry on an interrupted download', async () => {
    confirmSwitches();
    mockInstall.mockResolvedValueOnce({ status: 'failed' });
    const tree = await renderPicker();
    await pressWithText(tree, 'Florida');
    await settle();

    expect(textsOf(tree)).toContain('Download interrupted');
    expect(observedState!.user.stateCode).toBe('CA');

    installSucceeds();
    await pressWithText(tree, 'Try again');
    await settle();
    expect(mockInstall).toHaveBeenCalledTimes(2);
    expect(textsOf(tree)).toContain('Course ready');
  });

  it('keeps everything when the alert is cancelled', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const tree = await renderPicker();
    await ReactTestRenderer.act(async () => {
      observedState!.applyTopicResult('road-signs', 80);
    });
    await pressWithText(tree, 'Texas');

    expect(observedState!.user.stateCode).toBe('CA');
    expect(observedState!.topicScores['road-signs']).toBe(80);
    expect(courseStore.activeCourseId()).toBe('ca-class-c');
    expect(mockInstall).not.toHaveBeenCalled();
  });
});

describe('wipe over sync', () => {
  it('clears queued progress and rides the payload as wipe_progress', () => {
    let pending = emptyPending();
    pending = markPending(pending, { kind: 'lesson', lessonId: 'ca-l1' });
    pending = markPending(pending, { kind: 'exam' });
    pending = markPending(pending, { kind: 'wipe' });
    pending = markPending(pending, { kind: 'profile' });

    expect(pending.lessonIds).toEqual([]);
    expect(pending.examDirty).toBe(false);
    expect(pending.wipeDirty).toBe(true);

    const state = {
      ...require('@/state/AppState').initialState,
      user: { name: '', stateCode: 'TX', plan: 'free' as const },
    };
    const payload = buildPushPayload(state, pending);
    expect(payload.wipe_progress).toBe(true);
    expect(payload.lessons).toEqual([]);
  });

  it('does not resurrect server rows while a wipe is unpushed', () => {
    const { initialState } = require('@/state/AppState');
    const pending = markPending(emptyPending(), { kind: 'wipe' });
    const merged = mergeRemoteIntoLocal(
      initialState,
      {
        profile: {
          name: 'Ada',
          state_code: 'CA',
          plan: 'plus',
          accent_id: 'emerald',
          font_id: 'jakarta',
          best_exam: 90,
          current_streak: 5,
          last_active_date: '2026-08-10',
        },
        lessons: [
          { id: 'ca-l1', answered: 5, correct: 5, points: 50, completed: true },
        ],
        topics: [{ id: 'road-signs', best_percent: 90 }],
        question_stats: [{ id: 'q1', seen: 3, correct: 3, last_correct: true }],
        saved: [{ type: 'question', id: 'q3' }],
        mistakes: ['q2'],
      },
      pending,
    );
    expect(merged.lessonScores).toEqual({});
    expect(merged.topicScores).toEqual({});
    expect(merged.questionStats).toEqual({});
    expect(merged.bestExam).toBeNull();
    expect(merged.mistakeIds).toEqual([]);
    // Only the server-owned plan flows in.
    expect(merged.user.plan).toBe('plus');
  });
});
