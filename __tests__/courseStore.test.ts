import AsyncStorage from '@react-native-async-storage/async-storage';

import { SEED_COURSE_BUNDLE, SEED_DELIVERY_VERSION } from '@/data/course';
import { courseStore } from '@/data/course/store';
import type { CourseDocV2, ModuleDocV2 } from '@/data/course/v2/wire';

const META_KEY = 'dmv-prep/course/v2/ca-class-c/meta';

// A tiny two-module course for commit tests; a question shared between
// modules exercises the dedupe on assembly. The store does not validate
// (that happens upstream in the updater), so minimal doc shapes suffice.
const question = (id: string) => ({
  questionId: id,
  uuid: `00000000-0000-5000-8000-0000000000${id.length}${id.length}`,
  kind: 'lesson_checkpoint' as const,
  prompt: 'q',
  choices: [
    { id: 'A', text: 'a', feedback: 'fa' },
    { id: 'B', text: 'b', feedback: 'fb' },
    { id: 'C', text: 'c', feedback: 'fc' },
  ],
  correctAnswerId: 'A',
  explanation: 'e',
});

const asset = (id: string) => ({
  assetId: id,
  uuid: `00000000-0000-5000-8000-1000000000${id.length}${id.length}`,
  type: 'svg' as const,
  width: 1200,
  height: 675,
  alt: id,
  sha256: '0'.repeat(64),
  svgXml: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>',
});

const moduleDoc = (
  moduleId: string,
  questionIds: string[],
  assetIds: string[] = [],
): ModuleDocV2 => ({
  schemaVersion: 2,
  deliveryVersion: '2.1.0',
  module: {
    moduleId,
    uuid: `00000000-0000-5000-8000-2000000000ff`,
    sequence: 1,
    title: moduleId,
    outcome: '',
    lessons: [],
    moduleTest: {
      testId: `${moduleId}-test`,
      uuid: `00000000-0000-5000-8000-3000000000ff`,
      moduleId,
      questionIds,
    },
  },
  questions: questionIds.map(question),
  assets: assetIds.map(asset),
});

const courseDoc: CourseDocV2 = {
  schemaVersion: 2,
  deliveryVersion: '2.1.0',
  course: {
    ...SEED_COURSE_BUNDLE.course,
    moduleIds: ['m-b', 'm-a'],
  },
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  courseStore.resetForTests();
});

describe('courseStore (v2)', () => {
  it('serves the bundled seed synchronously before hydration', () => {
    const snapshot = courseStore.getSnapshot();
    expect(snapshot.deliveryVersion).toBe(SEED_DELIVERY_VERSION);
    expect(snapshot.bundle).toBe(SEED_COURSE_BUNDLE);
  });

  it('never writes the seed to storage', async () => {
    await courseStore.hydrate();
    expect(courseStore.isHydrated()).toBe(true);
    expect(courseStore.getSnapshot().bundle).toBe(SEED_COURSE_BUNDLE);
    const keys = await AsyncStorage.getAllKeys();
    expect(keys.filter(key => key.startsWith('dmv-prep/course/'))).toEqual([]);
  });

  it('commits atomically: stages docs, verifies them, writes meta last', async () => {
    const listener = jest.fn();
    courseStore.subscribe(listener);
    await courseStore.commit('2.1.0', courseDoc, [
      moduleDoc('m-a', ['q1', 'shared']),
      moduleDoc('m-b', ['q2', 'shared'], ['as-1']),
    ]);

    const snapshot = courseStore.getSnapshot();
    expect(snapshot.deliveryVersion).toBe('2.1.0');
    expect(snapshot.bundle.modules.map(m => m.moduleId)).toEqual([
      'm-b',
      'm-a',
    ]);
    expect(snapshot.bundle.questions.map(q => q.questionId)).toEqual([
      'q2',
      'shared',
      'q1',
    ]);
    expect(snapshot.bundle.assets.map(a => a.assetId)).toEqual(['as-1']);
    expect(listener).toHaveBeenCalled();
    expect(JSON.parse((await AsyncStorage.getItem(META_KEY))!)).toEqual({
      deliveryVersion: '2.1.0',
      moduleIds: ['m-b', 'm-a'],
    });
    // meta written strictly after the staged docs
    const setItemCalls = (AsyncStorage.setItem as jest.Mock).mock.calls.map(
      call => call[0],
    );
    expect(setItemCalls[setItemCalls.length - 1]).toBe(META_KEY);
  });

  it('rehydrates a committed version from storage', async () => {
    await courseStore.commit('2.1.0', courseDoc, [
      moduleDoc('m-a', ['q1']),
      moduleDoc('m-b', ['q2']),
    ]);
    courseStore.resetForTests();

    expect(courseStore.getSnapshot().deliveryVersion).toBe(
      SEED_DELIVERY_VERSION,
    );
    await courseStore.hydrate();
    expect(courseStore.getSnapshot().deliveryVersion).toBe('2.1.0');
    expect(
      courseStore.getSnapshot().bundle.modules.map(m => m.moduleId),
    ).toEqual(['m-b', 'm-a']);
  });

  it('stays on the seed when staged docs exist but the pointer was never written', async () => {
    // Simulates a kill between staging and the meta write.
    await AsyncStorage.setMany({
      'dmv-prep/course/v2/ca-class-c/2.1.0/course': JSON.stringify(courseDoc),
    });
    await courseStore.hydrate();
    expect(courseStore.getSnapshot().deliveryVersion).toBe(
      SEED_DELIVERY_VERSION,
    );
    // the orphaned staged doc is swept
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(await AsyncStorage.getAllKeys()).not.toContain(
      'dmv-prep/course/v2/ca-class-c/2.1.0/course',
    );
  });

  it('falls back to the seed and clears the pointer on a corrupted store', async () => {
    await AsyncStorage.setItem(
      META_KEY,
      JSON.stringify({ deliveryVersion: '9.9.9', moduleIds: ['missing'] }),
    );
    await courseStore.hydrate();
    expect(courseStore.getSnapshot().deliveryVersion).toBe(
      SEED_DELIVERY_VERSION,
    );
    expect(await AsyncStorage.getItem(META_KEY)).toBeNull();
  });

  it('sweeps other v2 versions and the abandoned v1 namespace after commit', async () => {
    await AsyncStorage.setItem(
      'dmv-prep/course/v2/ca-class-c/2.0.5/course',
      'stale-staged-doc',
    );
    await AsyncStorage.setItem('dmv-prep/course/v1/ca/meta', 'old-format');
    await AsyncStorage.setItem('dmv-prep/course/v1/ca/1.0.0/course', 'old');
    await courseStore.commit('2.1.0', courseDoc, [
      moduleDoc('m-a', ['q1']),
      moduleDoc('m-b', ['q2']),
    ]);
    // sweep runs fire-and-forget after commit resolves
    await new Promise(resolve => setTimeout(resolve, 0));
    const keys = await AsyncStorage.getAllKeys();
    expect(keys).not.toContain('dmv-prep/course/v2/ca-class-c/2.0.5/course');
    expect(keys).not.toContain('dmv-prep/course/v1/ca/meta');
    expect(keys).not.toContain('dmv-prep/course/v1/ca/1.0.0/course');
    expect(keys).toContain('dmv-prep/course/v2/ca-class-c/2.1.0/course');
  });
});
