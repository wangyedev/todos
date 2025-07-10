import React, { useState, useCallback } from "react";
import AudioRecorder from "./AudioRecorder";
import StreamingTranscription from "./StreamingTranscription";
import { AgentInteractionState, StreamingState } from "../types";
import { apiService } from "../services/api";

interface AgentInteractionProps {
  onTasksGenerated: (tasks: any[]) => void;
  isLoading: boolean;
}

const AgentInteraction: React.FC<AgentInteractionProps> = ({
  onTasksGenerated,
  isLoading,
}) => {
  const [state, setState] = useState<AgentInteractionState>({
    inputText: "",
    isLoading: false,
    error: null,
  });

  const [streamingState, setStreamingState] = useState<StreamingState>({
    isStreaming: false,
    currentPhase: "idle",
    transcribedText: "",
    isTyping: false,
    statusMessage: "",
  });

  const handleTextSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!state.inputText.trim()) {
        return;
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const tasks = await apiService.generateTasks({ text: state.inputText });
        onTasksGenerated(tasks);
        setState((prev) => ({ ...prev, inputText: "", isLoading: false }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error:
            error instanceof Error ? error.message : "Failed to generate tasks",
          isLoading: false,
        }));
      }
    },
    [state.inputText, onTasksGenerated]
  );

  const handleAudioSubmit = useCallback(
    async (audioBlob: Blob) => {
      setState((prev) => ({ ...prev, error: null }));

      try {
        // First, transcribe the audio
        console.log("Starting audio transcription...");
        const transcriptionResult = await apiService.transcribeVoice(audioBlob);
        console.log("Transcription result:", transcriptionResult);

        // Then, generate tasks from the transcribed text
        console.log("Starting task generation from transcribed text...");
        const tasks = await apiService.generateTasks({
          text: transcriptionResult.text,
        });
        console.log("Generated tasks:", tasks);

        if (tasks.length === 0) {
          setState((prev) => ({
            ...prev,
            error: `No tasks could be extracted from: "${transcriptionResult.text}". Please try speaking more clearly about specific tasks you need to complete.`,
          }));
        } else {
          onTasksGenerated(tasks);
        }
      } catch (error) {
        console.error("Error in handleAudioSubmit:", error);
        setState((prev) => ({
          ...prev,
          error:
            error instanceof Error
              ? error.message
              : "Failed to process voice command",
        }));
      }
    },
    [onTasksGenerated]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setState((prev) => ({ ...prev, inputText: e.target.value }));
    },
    []
  );

  const handleStreamingUpdate = useCallback(
    (newStreamingState: StreamingState) => {
      setStreamingState(newStreamingState);
    },
    []
  );

  const currentlyLoading = isLoading || state.isLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center justify-center gap-2">
          <span className="text-blue-400">🤖</span>
          AI Task Agent
        </h2>
        <p className="text-gray-400">
          Tell me what you need to do, and I'll organize it into tasks for you.
        </p>
      </div>

      {/* Input Form */}
      <form onSubmit={handleTextSubmit} className="space-y-4">
        <div className="flex gap-3">
          <textarea
            value={state.inputText}
            onChange={handleInputChange}
            placeholder="Type your tasks here... (e.g., 'I need to email the team, buy groceries, and schedule a meeting')"
            className="input-field flex-1 min-h-[100px] resize-none"
            rows={3}
            disabled={currentlyLoading}
          />
          <div className="flex flex-col gap-2">
            <button
              type="submit"
              disabled={currentlyLoading || !state.inputText.trim()}
              className="btn-primary px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {currentlyLoading ? "..." : "Generate"}
            </button>

            {/* Voice Input */}
            <div className="flex justify-center">
              <AudioRecorder
                onAudioSubmit={handleAudioSubmit}
                onTasksGenerated={onTasksGenerated}
                onStreamingUpdate={handleStreamingUpdate}
                disabled={currentlyLoading}
                useStreaming={true}
              />
            </div>
          </div>
        </div>
      </form>

      {/* Streaming transcription UI */}
      <StreamingTranscription streamingState={streamingState} />

      {/* Error Display */}
      {state.error && (
        <div
          className="p-4 bg-red-600 bg-opacity-20 border border-red-500 border-opacity-30 rounded-lg text-red-300 text-sm"
          role="alert"
        >
          <strong>Error:</strong> {state.error}
        </div>
      )}

      {/* Loading State */}
      {currentlyLoading && (
        <div className="text-center text-gray-400">
          <div className="inline-block w-6 h-6 border-2 border-gray-400 border-t-blue-400 rounded-full animate-spin mb-2"></div>
          <p className="text-sm">Processing your request...</p>
        </div>
      )}
    </div>
  );
};

export default AgentInteraction;
