export interface WritingAISettings {
  id?: number | null;
  provider_name: string;
  base_url: string;
  model_name: string;
  json_fallback_enabled: boolean;
  has_api_key: boolean;
  api_key_hint?: string | null;
  last_test_status?: string | null;
  last_tested_at?: string | null;
  last_failure_classification?: string | null;
  last_successful_mode?: string | null;
}

export interface WritingAISettingsUpdate {
  provider_name: string;
  base_url: string;
  model_name: string;
  api_key?: string;
  json_fallback_enabled: boolean;
}

export interface WritingAIModelDiscoveryRequest {
  base_url?: string;
  api_key?: string;
}

export interface ProviderModelInfo {
  id: string;
  created?: number | null;
  object?: string | null;
  owned_by?: string | null;
}

export interface ProviderModelsResponse {
  status: string;
  configured: boolean;
  base_url?: string | null;
  model_count: number;
  models: ProviderModelInfo[];
  last_failure_classification?: string | null;
  message: string;
}

export interface ProviderTestResponse {
  status: string;
  configured: boolean;
  model?: string | null;
  base_url?: string | null;
  last_successful_mode?: string | null;
  last_failure_classification?: string | null;
  message: string;
}
