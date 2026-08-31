import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  assetSource,
  missingAssets,
  resetAssetsForTests,
  warmAssets,
} from '@/data/assets/store';
import {
  fetchBootstrapRaw,
  fetchCourseDocRaw,
  fetchModuleDocRaw,
} from '@/data/course/client';
import { courseStore } from '@/data/course/store';
import { installCourse, runCourseUpdate } from '@/data/course/updater';
import type { CourseDocV2, ModuleDocV2 } from '@/data/course/v2/wire';
import { resetContentChannelForTests } from '@/lib/contentChannel';

// The real thing: the app's own install and update code against the content
// server that ships, with nothing mocked but the phone's storage. Opt-in —
// it needs the network and a minute — and the closest check there is to a
// device short of a device:
//
//   LIVE_SERVER=1 npx jest __tests__/liveCourse.test.ts
//
// Two questions. Does a fresh install take what production serves, pictures
// and all? And does a device on an older release, updated by delta, end up
// holding byte-for-byte what a fresh install holds — the whole point of the
// instruction machinery, checked on real content.

const live = process.env.LIVE_SERVER === '1' ? describe : describe.skip;

const COURSE = 'ca-class-c';
// A release production still serves below the current one, so a device on it
// is answered with a delta rather than a wholesale replacement.
const OLDER = process.env.LIVE_OLDER_VERSION ?? '3.2.8';

const deps = () => ({
  userId: 'live',
  getProgress: () => ({ lessonIds: [] as string[], topicIds: [] as string[] }),
  resetLessons: jest.fn(),
  resetTopics: jest.fn(),
});

live('the app against the live content server', () => {
  jest.setTimeout(240000);

  beforeEach(async () => {
    await AsyncStorage.clear();
    courseStore.resetForTests();
    resetAssetsForTests();
    resetContentChannelForTests();
  });

  let freshBundle: string;
  let latest: string;

  it('a fresh install takes what production serves, pictures included', async () => {
    const bootstrap = JSON.parse(
      await fetchBootstrapRaw(COURSE, null, '1.2.0'),
    );
    latest = bootstrap.course.latestVersion;
    expect(bootstrap.course.mode).toBe('full');

    const result = await installCourse({ courseId: COURSE });
    expect(result.status).toBe('installed');

    const held = courseStore.getSnapshot()!;
    expect(held.deliveryVersion).toBe(latest);
    expect(held.bundle.modules.length).toBeGreaterThan(0);
    expect(held.bundle.assets.length).toBeGreaterThan(50);
    // Every picture the course shows is on the device.
    expect(await missingAssets(held.bundle.assets)).toEqual([]);
    freshBundle = JSON.stringify(held.bundle);
  });

  it('a device on an older release, updated by delta, ends up holding exactly what a fresh install holds', async () => {
    expect(freshBundle).toBeDefined();
    // Put the device on the older release the way a download of it would
    // have: its own documents, committed under its own number.
    const courseDoc = JSON.parse(
      await fetchCourseDocRaw(COURSE, OLDER),
    ) as CourseDocV2;
    const moduleDocs: ModuleDocV2[] = [];
    for (const moduleId of courseDoc.course.moduleIds) {
      moduleDocs.push(
        JSON.parse(await fetchModuleDocRaw(COURSE, OLDER, moduleId)),
      );
    }
    await courseStore.commit(OLDER, courseDoc, moduleDocs);
    expect(courseStore.getSnapshot()!.deliveryVersion).toBe(OLDER);

    const bootstrap = JSON.parse(
      await fetchBootstrapRaw(COURSE, OLDER, '1.2.0'),
    );
    expect(bootstrap.course.mode).toBe('delta');

    const result = await runCourseUpdate(deps());
    expect(result.status).toBe('updated');
    const held = courseStore.getSnapshot()!;
    expect(held.deliveryVersion).toBe(latest);
    expect(await missingAssets(held.bundle.assets)).toEqual([]);
    // The instructions, the folding and the manifest safety net together
    // produced the same course a fresh install downloads whole.
    expect(JSON.stringify(held.bundle)).toBe(freshBundle);

    // And it works with the network gone: restart the phone in a tunnel, warm
    // what the course shows off the device, and every picture draws.
    resetAssetsForTests();
    courseStore.resetForTests();
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new TypeError('Network request failed');
    }) as typeof fetch;
    try {
      await courseStore.hydrate();
      const offline = courseStore.getSnapshot()!;
      await warmAssets(offline.bundle.assets.map(asset => asset.sha256));
      const undrawable = offline.bundle.assets.filter(
        asset => assetSource(asset) == null,
      );
      expect(undrawable).toEqual([]);
    } finally {
      globalThis.fetch = realFetch;
    }

    // And the device is now current: the next check downloads nothing.
    const again = await runCourseUpdate(deps());
    expect(again.status).toBe('up-to-date');
  });
});
