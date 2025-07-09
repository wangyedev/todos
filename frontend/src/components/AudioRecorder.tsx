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
    <div className="audio-recorder">
      <button
        type="button"
        onClick={toggleRecording}
        disabled={isDisabled}
        className={`recorder-button ${state.isRecording ? "recording" : ""} ${
          isDisabled ? "disabled" : ""
        }`}
        aria-label={state.isRecording ? "Stop recording" : "Start recording"}
      >
        <div className="recorder-icon">
          {state.isRecording ? (
            <div className="recording-indicator">
              <div className="pulse"></div>
              🎙️
            </div>
          ) : state.isProcessing ? (
            <div className="processing-indicator">⏳</div>
          ) : (
            <div className="mic-icon">🎤</div>
          )}
        </div>
        <span className="recorder-text">
          {state.isRecording
            ? "Stop Recording"
            : state.isProcessing
            ? "Processing..."
            : "Record Voice"}
        </span>
      </button>

      {state.error && (
        <div className="error-message" role="alert">
          {state.error}
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;
