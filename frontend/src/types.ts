export interface Task {
  id: string;
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
