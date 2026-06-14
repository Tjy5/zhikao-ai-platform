import apiClient from './apiClient';
import type {
  WritingAISettingsResponse,
  WritingAISettingsUpdate,
  ProviderModelsResponse,
  ProviderTestResponse,
  WritingAIModelDiscoveryRequest,
} from '../types/api';

export const settingsService = {
  /**
   * Get current AI settings
   */
  getSettings: async (): Promise<WritingAISettingsResponse> => {
    return apiClient.get<WritingAISettingsResponse>('/api/v1/settings/writing-ai');
  },

  /**
   * Update AI settings
   */
  updateSettings: async (data: WritingAISettingsUpdate): Promise<WritingAISettingsResponse> => {
    return apiClient.put<WritingAISettingsResponse>('/api/v1/settings/writing-ai', data);
  },

  /**
   * Discover available models
   */
  discoverModels: async (data?: WritingAIModelDiscoveryRequest): Promise<ProviderModelsResponse> => {
    return apiClient.post<ProviderModelsResponse>(
      '/api/v1/settings/writing-ai/models',
      data || {}
    );
  },

  /**
   * Test connection to AI provider
   */
  testConnection: async (): Promise<ProviderTestResponse> => {
    return apiClient.post<ProviderTestResponse>('/api/v1/settings/writing-ai/test', {});
  },
};

export default settingsService;
