export interface Task {
  id: number;
  task: string;
  completed: boolean;
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
