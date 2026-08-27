import {
  PRACTICE_TOPICS,
  questionBankIds,
  topicQuestionIds,
} from '@/data/practice';

describe('topicQuestionIds', () => {
  it('gives every practice topic a non-empty pool', () => {
    PRACTICE_TOPICS.forEach(topic => {
      expect(topicQuestionIds(topic.id).length).toBeGreaterThan(0);
    });
  });

  // The pool is what a topic's standing is derived from, so an id the app
  // never asks — or asks under a different id — would score the topic against
  // answers that can never arrive.
  it('draws only from the askable bank', () => {
    const bank = new Set(questionBankIds());
    PRACTICE_TOPICS.forEach(topic => {
      topicQuestionIds(topic.id).forEach(id => {
        expect(bank.has(id)).toBe(true);
      });
    });
  });

  it('keeps the topics disjoint, so an answer scores one topic only', () => {
    const owner = new Map<string, string>();
    PRACTICE_TOPICS.forEach(topic => {
      topicQuestionIds(topic.id).forEach(id => {
        expect(owner.get(id)).toBeUndefined();
        owner.set(id, topic.id);
      });
    });
  });

  it('is empty for an unknown topic rather than throwing', () => {
    expect(topicQuestionIds('no-such-topic')).toEqual([]);
  });
});
