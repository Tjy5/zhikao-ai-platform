import { describe, it, expect, vi } from 'vitest';
import { setLocal, getLocal, removeLocal } from '../storage';

describe('storage (local) with TTL', () => {
  it('基本读写', () => {
    setLocal('k1', { a: 1 });
    expect(getLocal<{ a: number }>('k1')?.a).toBe(1);
    removeLocal('k1');
    expect(getLocal('k1')).toBeNull();
  });

  it('TTL 过期失效', () => {
    vi.useFakeTimers();
    setLocal('k2', 'v2', { ttlSeconds: 5 });
    expect(getLocal('k2')).toBe('v2');
    vi.advanceTimersByTime(6000);
    expect(getLocal('k2')).toBeNull();
    vi.useRealTimers();
  });
});
