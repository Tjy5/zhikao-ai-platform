import '@testing-library/jest-dom/vitest';

// jsdom shares a single Node BroadcastChannel registry across vitest workers,
// which would let refresh signals bleed between unrelated test files. Drop the
// constructor in the test environment so writingHistoryRefresh falls back to the
// window CustomEvent path, which is naturally scoped to one jsdom realm.
if (typeof globalThis.BroadcastChannel !== 'undefined') {
  (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = undefined;
}
