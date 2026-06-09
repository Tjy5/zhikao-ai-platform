import { API_BASE_URL } from '../config/api';
import {
  clearStoredAuthToken,
  authenticatedFetch,
  withAuthHeaders,
} from '../services/authSession';
import type {
  AuthLoginPayload,
  AuthRegisterPayload,
  AuthTokenResponse,
  AuthUser,
} from '../types/auth';
import type {
  WritingAIModelDiscoveryRequest,
  WritingAISettings,
  WritingAISettingsUpdate,
  ProviderModelsResponse,
  ProviderTestResponse,
} from '../types/settings';
import type { RawWritingFeedbackResult } from '../types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, headers, ...customConfig } = options;

  let url = `${API_BASE_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const config: RequestInit = {
    ...customConfig,
    headers: {
      'Content-Type': 'application/json',
      ...withAuthHeaders(headers),
    },
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new ApiError(
      response.status,
      `HTTP error! status: ${response.status} ${errorText}`
    );
  }

  // Handle empty responses (like DELETE)
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const apiClient = {
  get: <T>(
    endpoint: string,
    options?: Omit<RequestOptions, 'method' | 'body'>
  ) => request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(
    endpoint: string,
    data?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>
  ) =>
    request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(
    endpoint: string,
    data?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>
  ) =>
    request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(
    endpoint: string,
    options?: Omit<RequestOptions, 'method' | 'body'>
  ) => request<T>(endpoint, { ...options, method: 'DELETE' }),
};

export const authApi = {
  login: (payload: AuthLoginPayload) =>
    request<AuthTokenResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  register: (payload: AuthRegisterPayload) =>
    request<AuthUser>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  me: () => request<AuthUser>('/api/v1/auth/me', { method: 'GET' }),
  logout: () => clearStoredAuthToken(),
};

export const writingApi = {
  grade: (payload: { content: string; task_type?: string }) =>
    apiClient.post<RawWritingFeedbackResult>('/api/v1/writings/grade', payload),
  gradeProgressive: (payload: { content: string; task_type?: string }) =>
    authenticatedFetch(`${API_BASE_URL}/api/v1/writings/grade-progressive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(payload),
    }),
  status: () =>
    apiClient.get<Record<string, unknown>>('/api/v1/writings/ai-status'),
};

export const historyApi = {
  list: (limit = 50) =>
    apiClient.get<{ items: unknown[] }>('/api/v1/writings/history', {
      params: { limit },
    }),
  detail: (itemId: string) =>
    apiClient.get<Record<string, unknown>>(`/api/v1/writings/history/${itemId}`),
  clear: () => apiClient.delete<{ deleted: number }>('/api/v1/writings/history'),
};

export const settingsApi = {
  get: () => apiClient.get<WritingAISettings>('/api/v1/settings/writing-ai'),
  save: (payload: WritingAISettingsUpdate) =>
    apiClient.put<WritingAISettings>('/api/v1/settings/writing-ai', payload),
  discoverModels: (payload: WritingAIModelDiscoveryRequest) =>
    apiClient.post<ProviderModelsResponse>(
      '/api/v1/settings/writing-ai/models',
      payload
    ),
  test: () =>
    apiClient.post<ProviderTestResponse>('/api/v1/settings/writing-ai/test'),
};
