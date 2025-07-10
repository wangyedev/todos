export interface Task {
  id: string;
  task: string;
  completed: boolean;
  priority?: "low" | "medium" | "high";
  estimatedDuration?: string;
  category?: string;
  notes?: string;
  isParent?: boolean;
  subtasks?: Task[];
  parentId?: string;
  order?: number;
  dueDate?: string; // ISO date string
  createdDate: string; // ISO date string
  startDate?: string; // ISO date string;
}

export interface TaskGroup {
  id: string;
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high";
  estimatedDuration?: string;
  category?: string;
  tasks: Task[];
  completed?: boolean;
  progress?: number;
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
    priority?: "low" | "medium" | "high";
    estimatedDuration?: string;
    category?: string;
    notes?: string;
    isParent?: boolean;
    dueDate?: string;
    startDate?: string;
    subtasks?: Array<{
      id: number;
      task: string;
      priority?: "low" | "medium" | "high";
      estimatedDuration?: string;
      category?: string;
      notes?: string;
      dueDate?: string;
      startDate?: string;
    }>;
  }>;
}
