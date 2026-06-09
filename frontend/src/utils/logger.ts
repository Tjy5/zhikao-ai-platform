/* 简易前端调试日志工具：通过 VITE_DEBUG 控制 */
const enabled =
  typeof import.meta !== 'undefined' &&
  import.meta.env &&
  import.meta.env.VITE_DEBUG === 'true';

export function debugLog(...args: unknown[]) {
  if (enabled) {
    console.log(...args);
  }
}

export function debugWarn(...args: unknown[]) {
  if (enabled) {
    console.warn(...args);
  }
}

export function debugError(...args: unknown[]) {
  if (enabled) {
    console.error(...args);
  }
}
