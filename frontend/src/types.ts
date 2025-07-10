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
  startDate?: string; // ISO date string
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

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface GenerateTasksRequest {
  text: string;
}

export interface TranscribeVoiceResponse {
  text: string;
}

export interface AudioRecorderState {
  isRecording: boolean;
  isProcessing: boolean;
  error: string | null;
}

export interface StreamingState {
  isStreaming: boolean;
  currentPhase:
    | "idle"
    | "processing"
    | "transcribing"
    | "generating"
    | "complete"
    | "error";
  transcribedText: string;
  isTyping: boolean;
  statusMessage: string;
}

export interface SSEMessage {
  type:
    | "status"
    | "transcription_start"
    | "transcription_partial"
    | "transcription_complete"
    | "task_generation_start"
    | "task_generation_complete"
    | "error";
  data: any;
}

export interface AgentInteractionState {
  inputText: string;
  isLoading: boolean;
  error: string | null;
}

export interface AppState {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
}
