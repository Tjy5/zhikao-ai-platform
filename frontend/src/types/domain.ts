// Domain models (internal representation)

export interface User {
  id: number;
  username: string;
  email: string;
  isActive: boolean;
}

export interface AISettings {
  id: number | null;
  providerName: string;
  baseUrl: string;
  modelName: string;
  jsonFallbackEnabled: boolean;
  hasApiKey: boolean;
  apiKeyHint: string | null;
  lastTestStatus: 'succeeded' | 'failed' | 'unavailable' | null;
  lastTestedAt: Date | null;
  lastFailureClassification: string | null;
  lastSuccessfulMode: string | null;
}

export interface WritingFeedback {
  content: string;
  format: 'markdown' | 'text';
}

export interface HistoryRecord {
  id: string;
  submittedAt: Date;
  content: string;
  feedback: WritingFeedback | null;
  status: 'success' | 'failed';
  errorMessage?: string;
}

export enum ErrorType {
  NETWORK = 'network',
  AUTH = 'auth',
  VALIDATION = 'validation',
  SERVER = 'server',
  UNKNOWN = 'unknown',
}

export class AppError extends Error {
  type: ErrorType;
  details?: unknown;

  constructor(type: ErrorType, message: string, details?: unknown) {
    super(message);
    this.type = type;
    this.details = details;
    this.name = 'AppError';
  }
}
