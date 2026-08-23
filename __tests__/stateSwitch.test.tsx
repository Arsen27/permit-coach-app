import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert } from 'react-native';
import { ThemeProvider } from 'styled-components/native';

import { COURSE_SEEDS, courseIdForState } from '@/data/course';
import { courseStore } from '@/data/course/store';
import { SUPPORTED_STATES } from '@/data/states';
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

const pressState = async (
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

beforeEach(async () => {
  const AsyncStorage =
    require('@react-native-async-storage/async-storage').default;
  await AsyncStorage.clear();
  courseStore.resetForTests();
  observedState = null;
  mockGoBack.mockClear();
  jest.restoreAllMocks();
});

describe('course selection by state', () => {
  it('maps exactly the supported states to their courses', () => {
    expect(SUPPORTED_STATES.map(state => state.code)).toEqual([
      'CA',
      'FL',
      'TX',
    ]);
    expect(courseIdForState('CA')).toBe('ca-class-c');
    expect(courseIdForState('FL')).toBe('fl-class-e');
    expect(courseIdForState('TX')).toBe('tx-class-c');
    // Unknown states fall back rather than crash.
    expect(courseIdForState('NY')).toBe('ca-class-c');
  });

  it('ships a complete seed for each course', () => {
    for (const [courseId, seed] of Object.entries(COURSE_SEEDS)) {
      expect(seed.bundle.course.courseId).toBe(courseId);
      expect(seed.bundle.modules).toHaveLength(8);
      expect(seed.bundle.questions.length).toBeGreaterThanOrEqual(150);
      expect(seed.bundle.assets.length).toBeGreaterThanOrEqual(140);
    }
    expect(COURSE_SEEDS['ca-class-c'].bundle.questions).toHaveLength(224);
  });

  it('switches the served bundle when the active course changes', () => {
    expect(courseStore.getSnapshot().bundle.course.courseId).toBe('ca-class-c');
    courseStore.setActiveCourse('fl-class-e');
    expect(courseStore.getSnapshot().bundle.course.courseId).toBe('fl-class-e');
    expect(courseStore.getSnapshot().bundle.course.state).toBe('Florida');
    courseStore.setActiveCourse('tx-class-c');
    expect(courseStore.getSnapshot().bundle.course.jurisdiction).toBe('TX');
  });
});

describe('switching state in settings', () => {
  it('lists only the three supported states', async () => {
    const tree = await renderPicker();
    const texts = tree.root
      .findAll(node => String(node.type) === 'Text')
      .flatMap(t => t.children.filter(c => typeof c === 'string'));
    expect(texts).toEqual(
      expect.arrayContaining(['California', 'Florida', 'Texas']),
    );
    expect(texts).not.toContain('New York');
  });

  it('warns even when there is no progress yet', async () => {
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_t, _m, buttons) => {
        buttons?.find(button => button.style === 'destructive')?.onPress?.();
      });
    const tree = await renderPicker();
    await pressState(tree, 'Florida');

    expect(alertSpy).toHaveBeenCalledWith(
      'Switch to Florida?',
      expect.stringContaining('permanently erased'),
      expect.anything(),
    );
    expect(observedState!.user.stateCode).toBe('FL');
    expect(courseStore.activeCourseId()).toBe('fl-class-e');
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('closes without an alert when re-picking the current state', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const tree = await renderPicker();
    await pressState(tree, 'California');

    expect(alertSpy).not.toHaveBeenCalled();
    expect(observedState!.user.stateCode).toBe('CA');
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('asks before erasing and wipes course progress on confirm', async () => {
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_t, _m, buttons) => {
        buttons?.find(button => button.style === 'destructive')?.onPress?.();
      });

    const tree = await renderPicker();
    await ReactTestRenderer.act(async () => {
      observedState!.applyTopicResult('road-signs', 80);
      observedState!.applyExamResult(72);
      observedState!.recordQuestionAnswer('q1', true);
      observedState!.recordMistake('q2');
      observedState!.toggleSavedQuestion('q3');
      observedState!.toggleSavedSign('sign-1');
    });

    await pressState(tree, 'Texas');

    expect(alertSpy).toHaveBeenCalledWith(
      'Switch to Texas?',
      expect.stringContaining('permanently erased'),
      expect.anything(),
    );
    expect(observedState!.user.stateCode).toBe('TX');
    expect(courseStore.activeCourseId()).toBe('tx-class-c');
    expect(observedState!.topicScores).toEqual({});
    expect(observedState!.bestExam).toBeNull();
    expect(observedState!.questionStats).toEqual({});
    expect(observedState!.mistakeIds).toEqual([]);
    expect(observedState!.savedQuestionIds).toEqual([]);
    // The streak and saved signs are not course progress.
    expect(observedState!.savedSignIds).toEqual(['sign-1']);
  });

  it('keeps everything when the alert is cancelled', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const tree = await renderPicker();
    await ReactTestRenderer.act(async () => {
      observedState!.applyTopicResult('road-signs', 80);
    });
    await pressState(tree, 'Texas');

    expect(observedState!.user.stateCode).toBe('CA');
    expect(observedState!.topicScores['road-signs']).toBe(80);
    expect(courseStore.activeCourseId()).toBe('ca-class-c');
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
