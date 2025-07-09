import React, { useState, useCallback } from "react";
import AudioRecorder from "./AudioRecorder";
import { AgentInteractionState } from "../types";
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

  const currentlyLoading = isLoading || state.isLoading;

  return (
    <div className="text-center text-white">
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent">
          🤖 AI Task Agent
        </h1>
        <p className="text-xl md:text-2xl mb-8 text-white text-opacity-90">
          Tell me what you need to do, and I'll organize it into tasks for you.
        </p>
      </div>

      <div className="max-w-2xl mx-auto">
        <form onSubmit={handleTextSubmit} className="mb-8">
          <div className="flex flex-col gap-4">
            <textarea
              value={state.inputText}
              onChange={handleInputChange}
              placeholder="Type your tasks here... (e.g., 'I need to email the team, buy groceries, and schedule a meeting')"
              className="input-field w-full min-h-[120px] resize-y"
              rows={4}
              disabled={currentlyLoading}
            />
            <button
              type="submit"
              disabled={currentlyLoading || !state.inputText.trim()}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed text-lg"
            >
              {currentlyLoading ? "Processing..." : "Generate Tasks"}
            </button>
          </div>
        </form>

        <div className="relative my-8 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white border-opacity-20"></div>
          </div>
          <div className="relative">
            <span className="bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent font-medium px-4">
              OR
            </span>
          </div>
        </div>

        <div className="voice-input-section">
          <AudioRecorder
            onAudioSubmit={handleAudioSubmit}
            disabled={currentlyLoading}
          />
        </div>
      </div>

      {state.error && (
        <div
          className="mt-6 p-4 bg-red-500 bg-opacity-10 border border-red-500 border-opacity-30 rounded-lg text-red-200 text-center max-w-2xl mx-auto"
          role="alert"
        >
          <strong>Error:</strong> {state.error}
        </div>
      )}

      {currentlyLoading && (
        <div className="mt-6 text-center text-white">
          <div className="inline-block w-10 h-10 border-4 border-white border-opacity-30 border-t-white rounded-full animate-spin mb-4"></div>
          <p className="text-lg">Processing your request...</p>
        </div>
      )}
    </div>
  );
};

export default AgentInteraction;
