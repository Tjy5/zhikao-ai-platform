import apiClient from './apiClient';
import type {
  RegisterRequest,
  LoginRequest,
  UserResponse,
  TokenResponse,
} from '../types/api';

export const authService = {
  /**
   * Register a new user
   */
  register: async (data: RegisterRequest): Promise<UserResponse> => {
    return apiClient.post<UserResponse>('/api/v1/auth/register', data);
  },

  /**
   * Login with username/email and password
   */
  login: async (data: LoginRequest): Promise<TokenResponse> => {
    return apiClient.post<TokenResponse>('/api/v1/auth/login', data);
  },

  /**
   * Get current user info
   */
  me: async (): Promise<UserResponse> => {
    return apiClient.get<UserResponse>('/api/v1/auth/me');
  },
};

export default authService;
