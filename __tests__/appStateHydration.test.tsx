import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import { appStateKey, stageAdoptFromUser } from '@/sync/pendingStore';
import { AppStateProvider, useAppState } from '@/state/AppState';

jest.mock('@/sync/engine', () => ({
  SyncEngine: class {
    start = async () => undefined;
    stop = () => undefined;
    markDirty = () => undefined;
  },
}));

let observed: ReturnType<typeof useAppState> | null = null;
const Probe: React.FC = () => {
  observed = useAppState();
  return null;
};

const mount = async (userId: string): Promise<void> => {
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(
      <AppStateProvider userId={userId}>
        <Probe />
      </AppStateProvider>,
    );
  });
};

const storage = () =>
  require('@react-native-async-storage/async-storage').default;

beforeEach(async () => {
  await storage().clear();
  observed = null;
});

// A device upgrading from a build that predates the fields now synced to the
// cloud: nothing may crash, and the missing fields take their zero values.
const legacyState = {
  user: { name: 'Ada', stateCode: 'CA', plan: 'free' },
  // No longestStreak / daysStudied, and no questionStats at all.
  streak: { currentStreak: 3, lastActiveDate: '2026-08-10' },
  lessonScores: {},
  topicScores: { 'road-signs': 60 },
  bestExam: 70,
  savedQuestionIds: [],
  mistakeIds: [],
  savedSignIds: [],
  accentId: 'emerald',
  fontId: 'jakarta',
};

describe('hydrating a snapshot from an older build', () => {
  it('fills in the fields the stored snapshot never had', async () => {
    await storage().setItem(appStateKey('u1'), JSON.stringify(legacyState));
    await mount('u1');

    expect(observed!.questionStats).toEqual({});
    expect(observed!.topicScores['road-signs']).toBe(60);
    // The current run is the floor for both lifetime stats.
    expect(observed!.streak).toEqual({
      currentStreak: 3,
      lastActiveDate: '2026-08-10',
      longestStreak: 3,
      daysStudied: 3,
    });
  });

  it('adopts an older snapshot into a new account without crashing', async () => {
    await storage().setItem(
      appStateKey('old-user'),
      JSON.stringify(legacyState),
    );
    await stageAdoptFromUser('old-user');

    await mount('new-user');

    expect(observed!.user.name).toBe('Ada');
    expect(observed!.topicScores['road-signs']).toBe(60);
    expect(observed!.bestExam).toBe(70);
    expect(observed!.questionStats).toEqual({});
    expect(observed!.streak.longestStreak).toBe(3);
    expect(observed!.streak.daysStudied).toBe(3);
  });
});

describe('accent ids that this build no longer ships', () => {
  it('falls back to the default so the picker always has a selection', async () => {
    await storage().setItem(
      appStateKey('u2'),
      JSON.stringify({ ...legacyState, accentId: 'mint' }),
    );
    await mount('u2');
    expect(observed!.accentId).toBe('emerald');
  });
});
