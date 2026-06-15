import type { ApiErrorResponse } from '../types/api';
import { AppError, ErrorType } from '../types/domain';

/**
 * Unified fetch wrapper for the 成公 backend.
 *
 * Responsibilities (design.md §8):
 *  - Inject `Authorization: Bearer <token>` from localStorage / sessionStorage.
 *  - Normalize errors into `AppError` (network / auth / validation / server /
 *    unknown) with a user-friendly Chinese message for network failures.
 *  - On 401: clear stored tokens and invoke the registered unauthorized
 *    handler. The handler is wired by a Router-aware component
 *    (`ApiClientSync`) so the redirect uses `navigate('/login', ...)` with a
 *    `from` breadcrumb instead of a hard `window.location` jump.
 */
type UnauthorizedHandler = () => void;

class ApiClient {
  private baseURL: string;
  private unauthorizedHandler: UnauthorizedHandler | null = null;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8001';
  }

  /**
   * Register the 401 handler. Pass `null` to clear. Must be called from inside
   * a <BrowserRouter> subtree so `useNavigate` is available.
   */
  setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
    this.unauthorizedHandler = handler;
  }

  /**
   * Trigger the unauthorized flow from OUTSIDE `request()` (e.g. from `useSSE`,
   * which issues its own fetch for the grading stream and bypasses this client).
   *
   * Mirrors exactly what `handleResponse` does on a 401: clears stored tokens,
   * then invokes the registered handler (wired by `ApiClientSync`) so the app
   * clears auth state and navigates to `/login?from=<path>` — no
   * `window.location` hard jump. Safe to call when no handler is registered
   * (just clears tokens). Phase 8 SSE-401 cross-layer fix.
   */
  notifyUnauthorized() {
    this.clearToken();
    if (this.unauthorizedHandler) {
      this.unauthorizedHandler();
    }
  }

  private getToken(): string | null {
    // Remember-me uses localStorage; session-only uses sessionStorage.
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  }

  private clearToken() {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (response.status === 401) {
      // Auto-logout on unauthorized, then defer to the registered handler for
      // the redirect (keeps it testable and avoids a hard full-page reload).
      this.clearToken();
      if (this.unauthorizedHandler) {
        this.unauthorizedHandler();
      }
      throw new AppError(ErrorType.AUTH, '登录已过期，请重新登录', { status: 401 });
    }

    if (!response.ok) {
      let errorData: ApiErrorResponse;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: '未知错误，请稍后重试', status: response.status };
      }

      let errorType = ErrorType.SERVER;
      if (response.status >= 500) {
        errorType = ErrorType.SERVER;
      } else if (response.status === 403) {
        errorType = ErrorType.AUTH;
      } else if (response.status === 422 || response.status === 400) {
        errorType = ErrorType.VALIDATION;
      } else if (response.status === 404) {
        errorType = ErrorType.SERVER;
      }

      throw new AppError(errorType, errorData.message, {
        status: response.status,
        ...errorData,
      });
    }

    // 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestInit
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${this.baseURL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        ...options,
      });

      return this.handleResponse<T>(response);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      // Network error (DNS / offline / CORS / failed to fetch).
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new AppError(
          ErrorType.NETWORK,
          '无法连接到服务器，请检查网络连接',
          { originalError: error }
        );
      }

      throw new AppError(ErrorType.UNKNOWN, '未知错误，请稍后重试', {
        originalError: error,
      });
    }
  }

  get<T>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  post<T>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }

  put<T>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>('PUT', path, body, options);
  }

  delete<T>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>('DELETE', path, undefined, options);
  }
}

export const apiClient = new ApiClient();
export default apiClient;
