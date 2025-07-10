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
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
          <span className="text-white text-lg">🤖</span>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">
            AI Task Generator
          </h2>
          <p className="text-gray-400 text-sm">
            Tell me what you need to do, and I'll organize it into tasks
          </p>
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleTextSubmit} className="space-y-4">
        <div className="glass p-4">
          <div className="flex flex-col space-y-4">
            <textarea
              value={state.inputText}
              onChange={handleInputChange}
              placeholder="Type your tasks here... (e.g., 'I need to email the team, buy groceries, and schedule a meeting')"
              className="input-field w-full min-h-[120px] resize-none"
              rows={4}
              disabled={currentlyLoading}
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  type="submit"
                  disabled={currentlyLoading || !state.inputText.trim()}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {currentlyLoading ? (
                    <span className="flex items-center space-x-2">
                      <svg
                        className="w-4 h-4 animate-spin"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      <span>Generating...</span>
                    </span>
                  ) : (
                    "Generate Tasks"
                  )}
                </button>

                {/* Voice Input */}
                <AudioRecorder
                  onAudioSubmit={handleAudioSubmit}
                  onTasksGenerated={onTasksGenerated}
                  onStreamingUpdate={handleStreamingUpdate}
                  disabled={currentlyLoading}
                  useStreaming={true}
                />
              </div>

              {state.inputText.trim() && (
                <div className="text-xs text-gray-400">
                  {state.inputText.trim().split(/\s+/).length} words
                </div>
              )}
            </div>
          </div>
        </div>
      </form>

      {/* Streaming transcription UI */}
      <StreamingTranscription streamingState={streamingState} />

      {/* Error Display */}
      {state.error && (
        <div className="p-4 bg-red-900 bg-opacity-50 border border-red-500 border-opacity-50 rounded-lg text-red-300 text-sm">
          <div className="flex items-start space-x-2">
            <svg
              className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <strong className="font-medium">Error:</strong> {state.error}
            </div>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>
          💡 <strong>Tips:</strong>
        </p>
        <ul className="list-disc list-inside space-y-1 ml-4">
          <li>Be specific about what you need to do</li>
          <li>Include deadlines or priorities when possible</li>
          <li>Use voice input for natural conversation</li>
        </ul>
      </div>
    </div>
  );
};

export default AgentInteraction;
