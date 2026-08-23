import {
  emptyPending,
  isPendingEmpty,
  markPending,
  mergePending,
  subtractPending,
} from '@/sync/types';

describe('markPending', () => {
  it('collects entity keys without duplicates', () => {
    let pending = emptyPending();
    pending = markPending(pending, { kind: 'lesson', lessonId: 'l1' });
    pending = markPending(pending, { kind: 'lesson', lessonId: 'l1' });
    pending = markPending(pending, { kind: 'topic', topicId: 't1' });
    pending = markPending(pending, { kind: 'exam' });
    expect(pending.lessonIds).toEqual(['l1']);
    expect(pending.topicIds).toEqual(['t1']);
    expect(pending.examDirty).toBe(true);
  });

  it('self-compacts set ops: the last op for an item wins', () => {
    let pending = emptyPending();
    pending = markPending(pending, {
      kind: 'set',
      type: 'question',
      id: 'q1',
      op: 'add',
    });
    pending = markPending(pending, {
      kind: 'set',
      type: 'question',
      id: 'q1',
      op: 'remove',
    });
    expect(pending.setOps).toEqual({ 'question:q1': 'remove' });
  });
});

describe('subtractPending', () => {
  it('clears pushed marks but keeps ones that arrived in flight', () => {
    let pushed = emptyPending();
    pushed = markPending(pushed, { kind: 'lesson', lessonId: 'l1' });
    pushed = markPending(pushed, {
      kind: 'set',
      type: 'sign',
      id: 's1',
      op: 'add',
    });

    let current = pushed;
    current = markPending(current, { kind: 'lesson', lessonId: 'l2' });
    // The sign got un-saved while the push was in flight.
    current = markPending(current, {
      kind: 'set',
      type: 'sign',
      id: 's1',
      op: 'remove',
    });

    const rest = subtractPending(current, pushed);
    expect(rest.lessonIds).toEqual(['l2']);
    expect(rest.setOps).toEqual({ 'sign:s1': 'remove' });
  });

  it('keeps a question answered while its earlier answer was in flight', () => {
    let pushed = emptyPending();
    pushed = markPending(pushed, { kind: 'questionStat', questionId: 'q1' });

    let current = markPending(pushed, {
      kind: 'questionStat',
      questionId: 'q2',
    });
    const rest = subtractPending(current, pushed);
    expect(rest.questionStatIds).toEqual(['q2']);
    // A second answer to q1 re-marks it, so the newer history still ships.
    current = markPending(current, { kind: 'questionStat', questionId: 'q1' });
    expect(subtractPending(current, pushed).questionStatIds).toEqual(['q2']);
  });

  it('empties out when nothing arrived in flight', () => {
    let pending = emptyPending();
    pending = markPending(pending, { kind: 'profile' });
    pending = markPending(pending, { kind: 'streak' });
    expect(isPendingEmpty(subtractPending(pending, pending))).toBe(true);
  });
});

describe('mergePending', () => {
  it('unions queues with the later set op winning', () => {
    let earlier = emptyPending();
    earlier = markPending(earlier, { kind: 'lesson', lessonId: 'l1' });
    earlier = markPending(earlier, {
      kind: 'set',
      type: 'mistake',
      id: 'q1',
      op: 'add',
    });
    let later = emptyPending();
    later = markPending(later, { kind: 'lesson', lessonId: 'l2' });
    later = markPending(later, {
      kind: 'set',
      type: 'mistake',
      id: 'q1',
      op: 'remove',
    });

    const merged = mergePending(earlier, later);
    expect(merged.lessonIds.sort()).toEqual(['l1', 'l2']);
    expect(merged.setOps).toEqual({ 'mistake:q1': 'remove' });
  });
});

describe('reset ops', () => {
  it('marks, merges, and reports non-empty', () => {
    let pending = emptyPending();
    pending = markPending(pending, { kind: 'reset', type: 'lesson', id: 'l1' });
    pending = markPending(pending, { kind: 'reset', type: 'lesson', id: 'l1' });
    pending = markPending(pending, { kind: 'reset', type: 'topic', id: 't1' });
    expect(pending.resetOps).toEqual({ 'lesson:l1': true, 'topic:t1': true });
    expect(isPendingEmpty(pending)).toBe(false);

    const merged = mergePending(
      pending,
      markPending(emptyPending(), { kind: 'reset', type: 'lesson', id: 'l2' }),
    );
    expect(Object.keys(merged.resetOps).sort()).toEqual([
      'lesson:l1',
      'lesson:l2',
      'topic:t1',
    ]);
  });

  it('subtracts pushed resets, keeping ones marked mid-flight', () => {
    let pushed = emptyPending();
    pushed = markPending(pushed, { kind: 'reset', type: 'lesson', id: 'l1' });
    let pending = markPending(pushed, {
      kind: 'reset',
      type: 'lesson',
      id: 'l2',
    });
    pending = subtractPending(pending, pushed);
    expect(pending.resetOps).toEqual({ 'lesson:l2': true });
    expect(isPendingEmpty(subtractPending(pushed, pushed))).toBe(true);
  });

  it('tolerates stored queues from before resetOps existed', () => {
    const legacy = JSON.parse(
      '{"lessonIds":["l1"],"topicIds":[],"examDirty":false,"profileDirty":false,"streakDirty":false,"setOps":{}}',
    );
    const revived = { ...emptyPending(), ...legacy };
    expect(revived.resetOps).toEqual({});
    expect(isPendingEmpty(revived)).toBe(false);
  });
});
