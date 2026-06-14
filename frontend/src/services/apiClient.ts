import type { ApiErrorResponse } from '../types/api';
import { AppError, ErrorType } from '../types/domain';

class ApiClient {
  private baseURL: string;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8001';
  }

  private getToken(): string | null {
    // Check both storage locations for token
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (response.status === 401) {
      // Auto-logout on unauthorized - clean up both storage locations
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      window.location.href = '/login';
      throw new AppError(ErrorType.AUTH, 'Unauthorized', { status: 401 });
    }

    if (!response.ok) {
      let errorData: ApiErrorResponse;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: 'Unknown error occurred', status: response.status };
      }

      // Classify error type
      let errorType = ErrorType.SERVER;
      if (response.status >= 500) {
        errorType = ErrorType.SERVER;
      } else if (response.status === 401 || response.status === 403) {
        errorType = ErrorType.AUTH;
      } else if (response.status === 422 || response.status === 400) {
        errorType = ErrorType.VALIDATION;
      }

      throw new AppError(errorType, errorData.message, { status: response.status, ...errorData });
    }

    // Handle 204 No Content
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

      // Network error
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new AppError(
          ErrorType.NETWORK,
          '无法连接到服务器，请检查网络连接',
          { originalError: error }
        );
      }

      throw new AppError(ErrorType.UNKNOWN, '未知错误', { originalError: error });
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
