import { afterEach, describe, expect, it } from 'vitest';

import {
  publishWritingHistoryRefresh,
  subscribeWritingHistoryRefresh,
  type WritingHistoryRefreshPayload,
} from '../writingHistoryRefresh';

const flushAsync = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe('writingHistoryRefresh', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length) {
      const fn = cleanups.pop();
      try {
        fn?.();
      } catch {
        // ignore unsubscribe failures
      }
    }
  });

  it('delivers a published payload to a subscribed listener exactly once', async () => {
    const received: WritingHistoryRefreshPayload[] = [];
    cleanups.push(
      subscribeWritingHistoryRefresh(payload => received.push(payload))
    );

    const emitted = publishWritingHistoryRefresh({
      userId: 7,
      trigger: 'writing-grading',
    });
    await flushAsync();

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      signalId: emitted.signalId,
      userId: 7,
      trigger: 'writing-grading',
    });
    expect(typeof received[0].emittedAt).toBe('number');
  });

  it('keeps user scoping intact by allowing listeners to filter by userId', async () => {
    const received: WritingHistoryRefreshPayload[] = [];
    cleanups.push(
      subscribeWritingHistoryRefresh(payload => {
        if (payload.userId === 42) received.push(payload);
      })
    );

    publishWritingHistoryRefresh({ userId: 7, trigger: 'writing-grading' });
    publishWritingHistoryRefresh({ userId: 42, trigger: 'writing-grading' });
    publishWritingHistoryRefresh({ userId: null, trigger: 'writing-grading' });
    await flushAsync();

    expect(received).toHaveLength(1);
    expect(received[0].userId).toBe(42);
  });

  it('supports a null userId for unauthenticated publish paths', async () => {
    const received: WritingHistoryRefreshPayload[] = [];
    cleanups.push(
      subscribeWritingHistoryRefresh(payload => received.push(payload))
    );

    publishWritingHistoryRefresh({ userId: null, trigger: 'writing-grading' });
    await flushAsync();

    expect(received).toHaveLength(1);
    expect(received[0].userId).toBeNull();
  });

  it('stops invoking the listener after the unsubscribe callback runs', async () => {
    const received: WritingHistoryRefreshPayload[] = [];
    const unsubscribe = subscribeWritingHistoryRefresh(payload =>
      received.push(payload)
    );

    publishWritingHistoryRefresh({ userId: 1, trigger: 'writing-grading' });
    await flushAsync();
    expect(received).toHaveLength(1);

    unsubscribe();

    publishWritingHistoryRefresh({ userId: 1, trigger: 'writing-grading' });
    await flushAsync();
    expect(received).toHaveLength(1);
  });

  it('delivers each notification to multiple independent subscribers', async () => {
    const a: WritingHistoryRefreshPayload[] = [];
    const b: WritingHistoryRefreshPayload[] = [];
    cleanups.push(subscribeWritingHistoryRefresh(payload => a.push(payload)));
    cleanups.push(subscribeWritingHistoryRefresh(payload => b.push(payload)));

    publishWritingHistoryRefresh({ userId: 9, trigger: 'writing-grading' });
    await flushAsync();

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(a[0].signalId).toBe(b[0].signalId);
  });

  it('produces unique signal ids across rapid sequential publishes', () => {
    const first = publishWritingHistoryRefresh({
      userId: 1,
      trigger: 'writing-grading',
    });
    const second = publishWritingHistoryRefresh({
      userId: 1,
      trigger: 'writing-grading',
    });

    expect(first.signalId).not.toBe(second.signalId);
  });
});
