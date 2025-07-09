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

    fetch(`${API_BASE_URL}/api/transcribe-voice-stream`, {
      method: "POST",
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
                          lastTranscription = rawData.fullText || rawData.text;

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
            .catch((error) => {
              onError(error);
            });
        }

        readStream();
      })
      .catch((error) => {
        onError(
          error instanceof ApiError
            ? error
            : new ApiError("Failed to start streaming")
        );
      });
  },
};

export { ApiError };
