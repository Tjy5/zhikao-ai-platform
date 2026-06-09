type StoredValue<T> = {
  value: T;
  expiresAt?: number; // epoch ms
};

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isExpired(expiresAt?: number): boolean {
  return typeof expiresAt === 'number' && Date.now() > expiresAt;
}

export function setLocal<T>(
  key: string,
  value: T,
  options?: { ttlSeconds?: number }
) {
  if (typeof window === 'undefined') return;
  const payload: StoredValue<T> = {
    value,
    expiresAt: options?.ttlSeconds
      ? Date.now() + options.ttlSeconds * 1000
      : undefined,
  };
  localStorage.setItem(key, JSON.stringify(payload));
}

export function getLocal<T>(
  key: string,
  defaultValue: T | null = null
): T | null {
  if (typeof window === 'undefined') return defaultValue;
  const payload = safeParse<StoredValue<T>>(localStorage.getItem(key));
  if (!payload) return defaultValue;
  if (isExpired(payload.expiresAt)) {
    localStorage.removeItem(key);
    return defaultValue;
  }
  return payload.value ?? defaultValue;
}

export function removeLocal(key: string) {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key);
}

export function setSession<T>(
  key: string,
  value: T,
  options?: { ttlSeconds?: number }
) {
  if (typeof window === 'undefined') return;
  const payload: StoredValue<T> = {
    value,
    expiresAt: options?.ttlSeconds
      ? Date.now() + options.ttlSeconds * 1000
      : undefined,
  };
  sessionStorage.setItem(key, JSON.stringify(payload));
}

export function getSession<T>(
  key: string,
  defaultValue: T | null = null
): T | null {
  if (typeof window === 'undefined') return defaultValue;
  const payload = safeParse<StoredValue<T>>(sessionStorage.getItem(key));
  if (!payload) return defaultValue;
  if (isExpired(payload.expiresAt)) {
    sessionStorage.removeItem(key);
    return defaultValue;
  }
  return payload.value ?? defaultValue;
}

export function removeSession(key: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(key);
}
