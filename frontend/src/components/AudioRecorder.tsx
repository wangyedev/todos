import React, { useState, useRef, useCallback } from "react";
import { AudioRecorderState, StreamingState, Task } from "../types";
import { apiService } from "../services/api";

interface AudioRecorderProps {
  onAudioSubmit: (audioBlob: Blob) => Promise<void>;
  onTasksGenerated: (tasks: Task[]) => void;
  onStreamingUpdate: (streamingState: StreamingState) => void;
  disabled: boolean;
  useStreaming?: boolean;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onAudioSubmit,
  onTasksGenerated,
  onStreamingUpdate,
  disabled,
  useStreaming = true,
}) => {
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    isProcessing: false,
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentTranscriptionRef = useRef<string>("");

  const startRecording = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, error: null }));

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/wav",
        });
        setState((prev) => ({
          ...prev,
          isRecording: false,
          isProcessing: true,
        }));

        try {
          if (useStreaming) {
            // Use streaming API
            onStreamingUpdate({
              isStreaming: true,
              currentPhase: "processing",
              transcribedText: "",
              isTyping: false,
              statusMessage: "Processing audio...",
            });

            apiService.transcribeVoiceStream(
              audioBlob,
              (message) => {
                console.log("SSE Message:", message);

                switch (message.type) {
                  case "status":
                    onStreamingUpdate({
                      isStreaming: true,
                      currentPhase: "processing",
                      transcribedText: "",
                      isTyping: false,
                      statusMessage: message.data.message,
                    });
                    break;

                  case "transcription_start":
                    onStreamingUpdate({
                      isStreaming: true,
                      currentPhase: "transcribing",
                      transcribedText: "",
                      isTyping: true,
                      statusMessage: "",
                    });
                    break;

                  case "transcription_partial":
                    currentTranscriptionRef.current = message.data.text;
                    onStreamingUpdate({
                      isStreaming: true,
                      currentPhase: "transcribing",
                      transcribedText: message.data.text,
                      isTyping: true,
                      statusMessage: "",
                    });
                    break;

                  case "transcription_complete":
                    currentTranscriptionRef.current = message.data.text;
                    onStreamingUpdate({
                      isStreaming: true,
                      currentPhase: "transcribing",
                      transcribedText: message.data.text,
                      isTyping: false,
                      statusMessage: "",
                    });
                    break;

                  case "task_generation_start":
                    onStreamingUpdate({
                      isStreaming: true,
                      currentPhase: "generating",
                      transcribedText: currentTranscriptionRef.current,
                      isTyping: false,
                      statusMessage: message.data.message,
                    });
                    break;

                  case "task_generation_complete":
                    onTasksGenerated(message.data.tasks);
                    onStreamingUpdate({
                      isStreaming: true,
                      currentPhase: "complete",
                      transcribedText: "",
                      isTyping: false,
                      statusMessage: "",
                    });
                    // Hide streaming UI after a short delay
                    setTimeout(() => {
                      onStreamingUpdate({
                        isStreaming: false,
                        currentPhase: "idle",
                        transcribedText: "",
                        isTyping: false,
                        statusMessage: "",
                      });
                    }, 2000);
                    break;

                  case "error":
                    onStreamingUpdate({
                      isStreaming: true,
                      currentPhase: "error",
                      transcribedText: "",
                      isTyping: false,
                      statusMessage: message.data.message,
                    });
                    setTimeout(() => {
                      onStreamingUpdate({
                        isStreaming: false,
                        currentPhase: "idle",
                        transcribedText: "",
                        isTyping: false,
                        statusMessage: "",
                      });
                    }, 3000);
                    break;
                }
              },
              (error) => {
                console.error("Streaming error:", error);
                setState((prev) => ({
                  ...prev,
                  error: error.message || "Failed to process audio",
                }));
                onStreamingUpdate({
                  isStreaming: true,
                  currentPhase: "error",
                  transcribedText: "",
                  isTyping: false,
                  statusMessage: error.message || "Failed to process audio",
                });
                setTimeout(() => {
                  onStreamingUpdate({
                    isStreaming: false,
                    currentPhase: "idle",
                    transcribedText: "",
                    isTyping: false,
                    statusMessage: "",
                  });
                }, 3000);
              },
              () => {
                console.log("Streaming complete");
              }
            );
          } else {
            // Use original API
            await onAudioSubmit(audioBlob);
          }
        } catch (error) {
          setState((prev) => ({
            ...prev,
            error:
              error instanceof Error
                ? error.message
                : "Failed to process audio",
          }));
        } finally {
          setState((prev) => ({ ...prev, isProcessing: false }));
        }

        // Clean up stream
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current.start();
      setState((prev) => ({ ...prev, isRecording: true }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error ? error.message : "Failed to start recording",
      }));
    }
  }, [onAudioSubmit]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
    }
  }, [state.isRecording]);

  const toggleRecording = useCallback(() => {
    if (state.isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [state.isRecording, startRecording, stopRecording]);

  const isDisabled = disabled || state.isProcessing;

  return (
    <div className="text-center">
      <button
        type="button"
        onClick={toggleRecording}
        disabled={isDisabled}
        className={`
          inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 shadow-lg hover:shadow-xl
          ${
            state.isRecording
              ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
              : isDisabled
              ? "bg-gray-700 bg-opacity-50 text-gray-400 cursor-not-allowed"
              : "bg-blue-500 hover:bg-blue-600 text-white hover:scale-105"
          }
        `}
        aria-label={state.isRecording ? "Stop recording" : "Start recording"}
      >
        <div className="flex items-center justify-center text-lg">
          {state.isRecording ? (
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-red-200 rounded-full animate-pulse"></div>
              <span>🎙️</span>
            </div>
          ) : state.isProcessing ? (
            <div className="animate-spin">⏳</div>
          ) : (
            <span>🎤</span>
          )}
        </div>
        <span>
          {state.isRecording
            ? "Stop"
            : state.isProcessing
            ? "Processing..."
            : "Voice"}
        </span>
      </button>

      {state.error && (
        <div
          className="mt-3 p-2 bg-red-600 bg-opacity-20 border border-red-500 border-opacity-30 rounded text-red-300 text-xs max-w-xs mx-auto"
          role="alert"
        >
          {state.error}
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;
