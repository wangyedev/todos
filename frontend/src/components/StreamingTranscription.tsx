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
    <div className="mt-6 max-w-2xl mx-auto">
      <div className="glass p-6 text-gray-800">
        {/* Status indicator */}
        {streamingState.currentPhase === "processing" && (
          <div className="text-center mb-4">
            <div className="inline-block w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-2"></div>
            <p className="text-primary-600 font-medium">
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
              <span className="text-lg">🎙️</span>
              <h3 className="text-lg font-semibold text-gray-700">
                Transcription
              </h3>
              {streamingState.isTyping && (
                <div className="flex space-x-1">
                  <div className="w-1 h-1 bg-primary-500 rounded-full animate-bounce"></div>
                  <div
                    className="w-1 h-1 bg-primary-500 rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div
                    className="w-1 h-1 bg-primary-500 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-primary-500">
              <p className="text-gray-800 leading-relaxed">
                {streamingState.transcribedText}
                {streamingState.isTyping && (
                  <span className="inline-block w-0.5 h-5 bg-primary-500 ml-1 animate-pulse"></span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Task generation indicator */}
        {streamingState.currentPhase === "generating" && (
          <div className="text-center">
            <div className="inline-flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-secondary-50 to-secondary-100 rounded-lg">
              <div className="w-5 h-5 border-2 border-secondary-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-secondary-700 font-medium">
                Analyzing and generating tasks...
              </span>
            </div>
          </div>
        )}

        {/* Error state */}
        {streamingState.currentPhase === "error" && (
          <div className="text-center p-4 bg-red-50 border border-red-200 rounded-lg">
            <span className="text-red-600 font-medium">
              ❌ {streamingState.statusMessage}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StreamingTranscription;
