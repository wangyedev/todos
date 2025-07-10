import React from "react";
import { StreamingState } from "../types";

interface StreamingTranscriptionProps {
  streamingState: StreamingState;
}

const StreamingTranscription: React.FC<StreamingTranscriptionProps> = ({
  streamingState,
}) => {
  if (!streamingState.isStreaming) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="glass p-4">
        {/* Status indicator */}
        {streamingState.currentPhase === "processing" && (
          <div className="text-center mb-4">
            <div className="inline-block w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mb-2"></div>
            <p className="text-blue-400 font-medium text-sm">
              {streamingState.statusMessage}
            </p>
          </div>
        )}

        {/* Transcription section */}
        {(streamingState.currentPhase === "transcribing" ||
          streamingState.currentPhase === "generating" ||
          streamingState.currentPhase === "complete") && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-xs">🎙️</span>
              </div>
              <h3 className="text-base font-medium text-gray-200">
                Transcription
              </h3>
              {streamingState.isTyping && (
                <div className="flex space-x-1">
                  <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce"></div>
                  <div
                    className="w-1 h-1 bg-blue-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div
                    className="w-1 h-1 bg-blue-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
              )}
            </div>

            <div className="bg-gray-800 rounded-lg p-3 border-l-4 border-blue-500">
              <p className="text-gray-200 leading-relaxed text-sm">
                {streamingState.transcribedText}
                {streamingState.isTyping && (
                  <span className="inline-block w-0.5 h-4 bg-blue-400 ml-1 animate-pulse"></span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Task generation indicator */}
        {streamingState.currentPhase === "generating" && (
          <div className="text-center">
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-purple-900 to-purple-800 bg-opacity-50 rounded-lg border border-purple-500 border-opacity-30">
              <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-purple-300 font-medium text-sm">
                Analyzing and generating tasks...
              </span>
            </div>
          </div>
        )}

        {/* Complete state */}
        {streamingState.currentPhase === "complete" && (
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-900 bg-opacity-50 rounded-lg border border-green-500 border-opacity-30">
              <svg
                className="w-4 h-4 text-green-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-green-300 font-medium text-sm">
                Tasks generated successfully!
              </span>
            </div>
          </div>
        )}

        {/* Error state */}
        {streamingState.currentPhase === "error" && (
          <div className="text-center p-3 bg-red-900 bg-opacity-50 border border-red-500 border-opacity-30 rounded-lg">
            <div className="flex items-center justify-center space-x-2">
              <svg
                className="w-4 h-4 text-red-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-red-300 font-medium text-sm">
                {streamingState.statusMessage}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StreamingTranscription;
