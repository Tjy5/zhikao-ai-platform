/**
 * 反馈历史刷新事件总线
 * 提供 publish/subscribe API。
 * - 跨标签页：通过 BroadcastChannel
 * - 同运行时（含测试环境）：通过 window CustomEvent 同步派发
 * 订阅端通过 signalId 去重，避免双通道重复触发。
 */

const CHANNEL_NAME = 'writing-history-refresh-v1';
const WINDOW_EVENT_NAME = 'writing:history-refresh';

export type WritingHistoryRefreshTrigger = 'writing-grading';

export interface WritingHistoryRefreshPayload {
  signalId: string;
  userId: number | null;
  trigger: WritingHistoryRefreshTrigger;
  emittedAt: number;
}

export interface WritingHistoryRefreshInput {
  userId: WritingHistoryRefreshPayload['userId'];
  trigger: WritingHistoryRefreshTrigger;
}

export type WritingHistoryRefreshListener = (
  payload: WritingHistoryRefreshPayload
) => void;

let signalCounter = 0;

const createSignalId = (): string =>
  `${Date.now().toString(36)}-${(++signalCounter).toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

const isRefreshPayload = (
  value: unknown
): value is WritingHistoryRefreshPayload => {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.signalId === 'string' &&
    (obj.userId === null || typeof obj.userId === 'number') &&
    typeof obj.trigger === 'string' &&
    typeof obj.emittedAt === 'number'
  );
};

type BroadcastChannelCtor = new (name: string) => BroadcastChannel;

const getBroadcastChannelCtor = (): BroadcastChannelCtor | null => {
  if (typeof globalThis === 'undefined') return null;
  const ctor = (globalThis as { BroadcastChannel?: BroadcastChannelCtor })
    .BroadcastChannel;
  return typeof ctor === 'function' ? ctor : null;
};

const safeCloseChannel = (channel: BroadcastChannel | null): void => {
  if (!channel) return;
  try {
    channel.close();
  } catch {
    // ignore close failures
  }
};

export const publishWritingHistoryRefresh = (
  input: WritingHistoryRefreshInput
): WritingHistoryRefreshPayload => {
  const payload: WritingHistoryRefreshPayload = {
    signalId: createSignalId(),
    userId: input.userId,
    trigger: input.trigger,
    emittedAt: Date.now(),
  };

  const Ctor = getBroadcastChannelCtor();
  if (Ctor) {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new Ctor(CHANNEL_NAME);
      channel.postMessage(payload);
    } catch {
      // BroadcastChannel may fail in restricted environments; ignore.
    } finally {
      safeCloseChannel(channel);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent<WritingHistoryRefreshPayload>(WINDOW_EVENT_NAME, {
          detail: payload,
        })
      );
    } catch {
      // dispatchEvent may fail when CustomEvent is unavailable; ignore.
    }
  }

  return payload;
};

const SEEN_SIGNAL_LIMIT = 64;

export const subscribeWritingHistoryRefresh = (
  listener: WritingHistoryRefreshListener
): (() => void) => {
  const seenIds = new Set<string>();

  const dispatch = (payload: WritingHistoryRefreshPayload): void => {
    if (seenIds.has(payload.signalId)) return;
    seenIds.add(payload.signalId);
    if (seenIds.size > SEEN_SIGNAL_LIMIT) {
      const oldest = seenIds.values().next().value;
      if (oldest !== undefined) seenIds.delete(oldest);
    }
    listener(payload);
  };

  let channel: BroadcastChannel | null = null;
  const onChannelMessage = (event: MessageEvent): void => {
    if (isRefreshPayload(event.data)) dispatch(event.data);
  };

  const Ctor = getBroadcastChannelCtor();
  if (Ctor) {
    try {
      channel = new Ctor(CHANNEL_NAME);
      channel.addEventListener('message', onChannelMessage);
    } catch {
      channel = null;
    }
  }

  const onWindowEvent = (event: Event): void => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (isRefreshPayload(detail)) dispatch(detail);
  };

  const hasWindow = typeof window !== 'undefined';
  if (hasWindow) {
    window.addEventListener(WINDOW_EVENT_NAME, onWindowEvent as EventListener);
  }

  return () => {
    if (channel) {
      try {
        channel.removeEventListener('message', onChannelMessage);
      } catch {
        // ignore listener detach failures
      }
      safeCloseChannel(channel);
      channel = null;
    }
    if (hasWindow) {
      window.removeEventListener(
        WINDOW_EVENT_NAME,
        onWindowEvent as EventListener
      );
    }
  };
};
