import { Task, GenerateTasksRequest, TranscribeVoiceResponse } from "../types";
import { supabase } from "../lib/supabase";

const API_BASE_URL = "http://localhost:8000";

class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

const getAuthHeaders = async (): Promise<{ [key: string]: string }> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: { [key: string]: string } = {
    "Content-Type": "application/json",
  };

  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  return headers;
};

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
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/generate-tasks`, {
        method: "POST",
        headers,
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
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const formData = new FormData();
      formData.append("audio", audioBlob, "audio.wav");

      const headers: { [key: string]: string } = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`${API_BASE_URL}/api/transcribe-voice`, {
        method: "POST",
        headers,
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

  // New streaming API for real-time transcription and task generation
  transcribeVoiceStream(
    audioBlob: Blob,
    onMessage: (message: { type: string; data: any }) => void,
    onError: (error: Error) => void,
    onComplete: () => void
  ): void {
    const formData = new FormData();
    formData.append("audio", audioBlob, "audio.wav");

    let lastTranscription = "";

    // Get auth headers for streaming
    supabase.auth.getSession().then(({ data: { session } }) => {
      const headers: { [key: string]: string } = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      fetch(`${API_BASE_URL}/api/transcribe-voice-stream`, {
        method: "POST",
        headers,
        body: formData,
      })
        .then((response) => {
          if (!response.ok) {
            throw new ApiError(
              `Failed to start streaming: ${response.statusText}`,
              response.status
            );
          }

          const reader = response.body?.getReader();
          if (!reader) {
            throw new ApiError("Failed to get response reader");
          }

          const decoder = new TextDecoder();

          function readStream(): void {
            reader!
              .read()
              .then(({ done, value }) => {
                if (done) {
                  onComplete();
                  return;
                }

                const chunk = decoder.decode(value);
                const lines = chunk.split("\n");

                for (const line of lines) {
                  if (line.startsWith("data: ")) {
                    try {
                      const rawData = JSON.parse(line.slice(6));

                      // Transform server message format to frontend expected format
                      let transformedMessage: { type: string; data: any };

                      switch (rawData.phase) {
                        case "processing":
                          transformedMessage = {
                            type: "status",
                            data: { message: rawData.message },
                          };
                          break;

                        case "transcribing":
                          if (rawData.text !== undefined) {
                            // Store the latest transcription
                            lastTranscription =
                              rawData.fullText || rawData.text;

                            // Partial transcription chunk
                            transformedMessage = {
                              type: "transcription_partial",
                              data: { text: lastTranscription },
                            };
                          } else {
                            // Transcription started
                            transformedMessage = {
                              type: "transcription_start",
                              data: { message: rawData.message },
                            };
                          }
                          break;

                        case "generating":
                          if (rawData.text !== undefined) {
                            // Task generation in progress - we can ignore these chunks
                            continue;
                          } else {
                            // Send transcription complete first, then task generation start
                            onMessage({
                              type: "transcription_complete",
                              data: { text: lastTranscription },
                            });

                            // Task generation started
                            transformedMessage = {
                              type: "task_generation_start",
                              data: { message: rawData.message },
                            };
                          }
                          break;

                        case "complete":
                          transformedMessage = {
                            type: "task_generation_complete",
                            data: {
                              tasks: rawData.tasks || [],
                              transcription:
                                rawData.transcription || lastTranscription,
                            },
                          };
                          break;

                        case "error":
                          transformedMessage = {
                            type: "error",
                            data: { message: rawData.message },
                          };
                          break;

                        default:
                          console.warn("Unknown phase:", rawData.phase);
                          continue;
                      }

                      onMessage(transformedMessage);
                    } catch (error) {
                      console.error("Failed to parse SSE message:", error);
                    }
                  }
                }

                readStream();
              })
              .catch(onError);
          }

          readStream();
        })
        .catch(onError);
    });
  },

  // Database CRUD operations
  async getAllTasks(): Promise<Task[]> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: "GET",
        headers,
      });

      return await handleApiResponse(response);
    } catch (error) {
      console.error("Error getting tasks:", error);
      throw error instanceof ApiError
        ? error
        : new ApiError("Failed to get tasks");
    }
  },

  async getTaskById(id: string): Promise<Task> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/tasks/${id}`, {
        method: "GET",
        headers,
      });

      return await handleApiResponse(response);
    } catch (error) {
      console.error("Error getting task:", error);
      throw error instanceof ApiError
        ? error
        : new ApiError("Failed to get task");
    }
  },

  async updateTaskCompletion(
    id: string,
    completed: boolean
  ): Promise<{ success: boolean }> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/api/tasks/${id}/completion`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({ completed }),
        }
      );

      return await handleApiResponse(response);
    } catch (error) {
      console.error("Error updating task completion:", error);
      throw error instanceof ApiError
        ? error
        : new ApiError("Failed to update task completion");
    }
  },

  async deleteTask(id: string): Promise<{ success: boolean }> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/tasks/${id}`, {
        method: "DELETE",
        headers,
      });

      return await handleApiResponse(response);
    } catch (error) {
      console.error("Error deleting task:", error);
      throw error instanceof ApiError
        ? error
        : new ApiError("Failed to delete task");
    }
  },

  async clearAllTasks(): Promise<{ success: boolean }> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: "DELETE",
        headers,
      });

      return await handleApiResponse(response);
    } catch (error) {
      console.error("Error clearing all tasks:", error);
      throw error instanceof ApiError
        ? error
        : new ApiError("Failed to clear all tasks");
    }
  },

  async clearCompletedTasks(): Promise<{ success: boolean }> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/tasks/completed`, {
        method: "DELETE",
        headers,
      });

      return await handleApiResponse(response);
    } catch (error) {
      console.error("Error clearing completed tasks:", error);
      throw error instanceof ApiError
        ? error
        : new ApiError("Failed to clear completed tasks");
    }
  },

  async updateTaskText(
    id: string,
    text: string
  ): Promise<{ success: boolean }> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/tasks/${id}/text`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ text }),
      });

      return await handleApiResponse(response);
    } catch (error) {
      console.error("Error updating task text:", error);
      throw error instanceof ApiError
        ? error
        : new ApiError("Failed to update task text");
    }
  },

  async refineTaskText(
    text: string,
    refinementType: "formal" | "concise" | "detailed" | "casual"
  ): Promise<{
    originalText: string;
    refinedText: string;
    refinementType: string;
  }> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/refine-task-text`, {
        method: "POST",
        headers,
        body: JSON.stringify({ text, refinementType }),
      });

      return await handleApiResponse(response);
    } catch (error) {
      console.error("Error refining task text:", error);
      throw error instanceof ApiError
        ? error
        : new ApiError("Failed to refine task text");
    }
  },

  async updateTaskNotes(
    id: string,
    notes: string
  ): Promise<{ success: boolean }> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/tasks/${id}/notes`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ notes }),
      });

      return await handleApiResponse(response);
    } catch (error) {
      console.error("Error updating task notes:", error);
      throw error instanceof ApiError
        ? error
        : new ApiError("Failed to update task notes");
    }
  },

  async refineTaskNotes(
    notes: string,
    refinementType: "formal" | "concise" | "detailed" | "casual"
  ): Promise<{
    originalNotes: string;
    refinedNotes: string;
    refinementType: string;
  }> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/refine-task-notes`, {
        method: "POST",
        headers,
        body: JSON.stringify({ notes, refinementType }),
      });

      return await handleApiResponse(response);
    } catch (error) {
      console.error("Error refining task notes:", error);
      throw error instanceof ApiError
        ? error
        : new ApiError("Failed to refine task notes");
    }
  },
};

export { ApiError };
