import { posthog } from '@/analytics/client';
import { track, trackError } from '@/analytics';
import { noteStep } from '@/analytics/identity';

// What PostHog is asked to record about a course update, and about a crash.
// The client itself is null under jest (analytics is off there), so this
// pins the shape of the calls rather than the transport: a typo in an event
// name or a property is a silent hole in a dashboard nobody notices for
// weeks.

it('is disabled in tests, and every helper survives that', () => {
  expect(posthog).toBeNull();
  expect(() =>
    track('course_version_changed', {
      from: '3.2.11',
      to: '3.2.14',
      kind: 'fix',
      subtype: 'apology',
      channel: 'production',
    }),
  ).not.toThrow();
  expect(() => trackError(new Error('boom'), { where: 'test' })).not.toThrow();
  expect(() => noteStep('a step', { version: '3.2.14' })).not.toThrow();
});

it('names every course-update event the manager sends', () => {
  // Typed at the call site: an unknown name or a missing property fails the
  // build, so this only has to exercise each one once.
  expect(() => {
    track('course_sync_failed', { reason: 'offline', version: '3.2.14' });
    track('course_update_sheet_shown', {
      kind: 'apology',
      version: '3.2.14',
      lessons: 2,
    });
    track('course_update_sheet_answered', {
      kind: 'offer',
      version: '4.0.0',
      action: 'declined',
    });
    track('progress_reset', { state_code: 'CA', lessons_done: 7 });
  }).not.toThrow();
});
