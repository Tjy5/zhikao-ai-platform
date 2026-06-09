import { getLocal, removeLocal, setLocal } from '../utils/storage';
import type { AuthTokenResponse } from '../types/auth';

const AUTH_TOKEN_KEY = 'writing_feedback_auth_token';

interface StoredAuthToken {
  accessToken: string;
  tokenType: string;
}

export function saveStoredAuthToken(token: AuthTokenResponse) {
  setLocal<StoredAuthToken>(
    AUTH_TOKEN_KEY,
    {
      accessToken: token.access_token,
      tokenType: token.token_type || 'bearer',
    },
    { ttlSeconds: token.expires_in }
  );
}

export function getStoredAuthToken(): string | null {
  return getLocal<StoredAuthToken>(AUTH_TOKEN_KEY)?.accessToken ?? null;
}

export function clearStoredAuthToken() {
  removeLocal(AUTH_TOKEN_KEY);
}

export function withAuthHeaders(headers?: HeadersInit): Record<string, string> {
  const merged: Record<string, string> =
    headers instanceof Headers
      ? Object.fromEntries(headers.entries())
      : Array.isArray(headers)
        ? Object.fromEntries(
            headers.map(([key, value]) => [key, String(value)])
          )
        : headers
          ? { ...(headers as Record<string, string>) }
          : {};
  const token = getStoredAuthToken();
  const hasAuthorization = Object.keys(merged).some(
    key => key.toLowerCase() === 'authorization'
  );
  if (token && !hasAuthorization) {
    merged.Authorization = `Bearer ${token}`;
  }
  return merged;
}

export function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
) {
  return fetch(input, {
    ...init,
    headers: withAuthHeaders(init.headers),
  });
}
