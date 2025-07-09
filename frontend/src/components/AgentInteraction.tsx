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
        const transcriptionResult = await apiService.transcribeVoice(audioBlob);

        // Then, generate tasks from the transcribed text
        const tasks = await apiService.generateTasks({
          text: transcriptionResult.text,
        });
        onTasksGenerated(tasks);
      } catch (error) {
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
    <div className="agent-interaction">
      <div className="interaction-header">
        <h1>🤖 AI Task Agent</h1>
        <p>
          Tell me what you need to do, and I'll organize it into tasks for you.
        </p>
      </div>

      <div className="input-section">
        <form onSubmit={handleTextSubmit} className="text-input-form">
          <div className="input-group">
            <textarea
              value={state.inputText}
              onChange={handleInputChange}
              placeholder="Type your tasks here... (e.g., 'I need to email the team, buy groceries, and schedule a meeting')"
              className="text-input"
              rows={4}
              disabled={currentlyLoading}
            />
            <button
              type="submit"
              disabled={currentlyLoading || !state.inputText.trim()}
              className="submit-button"
            >
              {currentlyLoading ? "Processing..." : "Generate Tasks"}
            </button>
          </div>
        </form>

        <div className="divider">
          <span>OR</span>
        </div>

        <div className="voice-input-section">
          <AudioRecorder
            onAudioSubmit={handleAudioSubmit}
            disabled={currentlyLoading}
          />
        </div>
      </div>

      {state.error && (
        <div className="error-message" role="alert">
          <strong>Error:</strong> {state.error}
        </div>
      )}

      {currentlyLoading && (
        <div className="loading-indicator">
          <div className="loading-spinner"></div>
          <p>Processing your request...</p>
        </div>
      )}
    </div>
  );
};

export default AgentInteraction;
