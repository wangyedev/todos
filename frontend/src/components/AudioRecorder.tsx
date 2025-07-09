import React, { useState, useRef, useCallback } from "react";
import { AudioRecorderState } from "../types";

interface AudioRecorderProps {
  onAudioSubmit: (audioBlob: Blob) => Promise<void>;
  disabled: boolean;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onAudioSubmit,
  disabled,
}) => {
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    isProcessing: false,
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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
          await onAudioSubmit(audioBlob);
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
          inline-flex items-center gap-4 px-8 py-6 rounded-3xl font-medium text-lg transition-all duration-300 shadow-lg hover:shadow-xl min-w-[200px]
          ${
            state.isRecording
              ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white animate-pulse"
              : isDisabled
              ? "bg-white bg-opacity-10 text-white text-opacity-50 cursor-not-allowed"
              : "bg-gradient-to-r from-green-500 to-cyan-500 hover:from-green-600 hover:to-cyan-600 text-white hover:-translate-y-1"
          }
        `}
        aria-label={state.isRecording ? "Stop recording" : "Start recording"}
      >
        <div className="flex items-center justify-center text-2xl">
          {state.isRecording ? (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-200 rounded-full animate-pulse"></div>
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
            ? "Stop Recording"
            : state.isProcessing
            ? "Processing..."
            : "Record Voice"}
        </span>
      </button>

      {state.error && (
        <div
          className="mt-4 p-3 bg-red-500 bg-opacity-10 border border-red-500 border-opacity-30 rounded-lg text-red-200 text-center max-w-md mx-auto"
          role="alert"
        >
          {state.error}
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;
