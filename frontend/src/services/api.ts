import { Task, GenerateTasksRequest, TranscribeVoiceResponse } from "../types";

const API_BASE_URL = "http://localhost:8000";

class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

const handleApiResponse = async (response: Response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      errorData.error || `HTTP error! status: ${response.status}`,
      response.status
    );
  }
  return response.json();
};

export const apiService = {
  async generateTasks(request: GenerateTasksRequest): Promise<Task[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/generate-tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      return await handleApiResponse(response);
    } catch (error) {
      console.error("Error generating tasks:", error);
      throw error instanceof ApiError
        ? error
        : new ApiError("Failed to generate tasks");
    }
  },

  async transcribeVoice(audioBlob: Blob): Promise<TranscribeVoiceResponse> {
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "audio.wav");

      const response = await fetch(`${API_BASE_URL}/api/transcribe-voice`, {
        method: "POST",
        body: formData,
      });

      return await handleApiResponse(response);
    } catch (error) {
      console.error("Error transcribing voice:", error);
      throw error instanceof ApiError
        ? error
        : new ApiError("Failed to transcribe voice");
    }
  },

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/health`);
      return await handleApiResponse(response);
    } catch (error) {
      console.error("Health check failed:", error);
      throw error instanceof ApiError
        ? error
        : new ApiError("Health check failed");
    }
  },
};

export { ApiError };
