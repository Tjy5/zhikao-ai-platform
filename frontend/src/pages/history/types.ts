export interface HistoryItem {
  id: string;
  timestamp?: string;
  type?: string;
  taskType?: string;
  score?: number;
  content?: string;
  contentFormat?: string;
}

export interface HistoryDetail {
  id: string;
  timestamp?: string;
  type?: string;
  request: Record<string, unknown>;
  response: Record<string, unknown>;
  extra?: Record<string, unknown>;
}

export interface HistoryScoreDetail {
  item: string;
  fullScore: number;
  actualScore: number;
  description: string;
}
