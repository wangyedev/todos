export interface Task {
  id: string;
  task: string;
  completed: boolean;
}

export interface GenerateTasksRequest {
  text: string;
}

export interface TranscribeVoiceResponse {
  text: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
  details?: string;
}

export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  service: string;
}

export interface ModelInfo {
  name: string;
  displayName: string;
  supportedGenerationMethods: string[];
}

export interface ModelsResponse {
  models: ModelInfo[];
}

export interface ErrorResponse {
  error: string;
  details?: string | undefined;
}

export interface StructuredTaskResponse {
  tasks: Array<{
    id: number;
    task: string;
  }>;
}
