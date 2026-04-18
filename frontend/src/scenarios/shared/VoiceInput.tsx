/**
 * VoiceInput — mic button using ElevenLabs Scribe STT for transcription.
 *
 * Records audio via MediaRecorder, sends to ElevenLabs Scribe API,
 * returns transcript. Works in ALL modern browsers (Chrome, Firefox, Safari, Edge).
 *
 * Flow: tap mic → record → tap again to stop → "transcribing..." → text appears → auto-send
 * Max recording: 30 seconds (auto-stops).
 */

import { useState, useRef, useEffect } from "react";

const ELEVENLABS_API_KEY =
  (import.meta as unknown as { env: Record<string, string> }).env
    ?.VITE_ELEVENLABS_API_KEY ?? "";

const MAX_RECORDING_MS = 30000; // 30 seconds max

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  onAutoSend?: (text: string) => void;
  disabled?: boolean;
  autoSend?: boolean;
}

export default function VoiceInput({
  onTranscript,
  onAutoSend,
  disabled = false,
  autoSend = true,
}: VoiceInputProps) {
  const [state, setState] = useState<"idle" | "recording" | "transcribing">("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording(false);
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    };
  }, []);

  async function startRecording() {
    if (disabled || state !== "idle") return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        transcribe(blob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setState("recording");

      // Auto-stop after max duration
      maxTimerRef.current = setTimeout(() => {
        stopRecording(true);
      }, MAX_RECORDING_MS);
    } catch (err) {
      console.error("Microphone access denied:", err);
      setState("idle");
    }
  }

  function stopRecording(sendToTranscribe: boolean) {
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      if (sendToTranscribe) {
        mediaRecorderRef.current.stop(); // triggers onstop → transcribe
      } else {
        mediaRecorderRef.current.stop();
      }
    }

    // Release mic
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    mediaRecorderRef.current = null;
  }

  async function transcribe(audioBlob: Blob) {
    setState("transcribing");

    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "recording.webm");
      formData.append("model_id", "scribe_v1");

      const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: formData,
      });

      if (!res.ok) {
        console.error("ElevenLabs STT error:", res.status);
        setState("idle");
        return;
      }

      const data = await res.json();
      const text = (data.text || "").trim();

      if (text) {
        onTranscript(text);

        if (autoSend && onAutoSend) {
          // Brief pause so user sees their words before send
          setTimeout(() => {
            onAutoSend(text);
          }, 400);
        }
      }
    } catch (err) {
      console.error("ElevenLabs STT network error:", err);
    }

    setState("idle");
  }

  function handleClick() {
    if (state === "recording") {
      stopRecording(true);
    } else if (state === "idle") {
      startRecording();
    }
    // Do nothing if transcribing — wait for it to finish
  }

  const isRecording = state === "recording";
  const isTranscribing = state === "transcribing";

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isTranscribing}
      aria-label={
        isRecording
          ? "Stop recording"
          : isTranscribing
          ? "Transcribing..."
          : "Start recording"
      }
      style={{
        backgroundColor: "transparent",
        border: "1px solid",
        borderColor: disabled || isTranscribing
          ? "#1a1a26"
          : isRecording
          ? "#553333"
          : "#2a2a44",
        borderRadius: "8px",
        color: disabled || isTranscribing
          ? "#2a2a38"
          : isRecording
          ? "#aa4444"
          : "#7070aa",
        fontSize: "14px",
        padding: "10px 14px",
        cursor: disabled || isTranscribing ? "not-allowed" : "pointer",
        fontFamily: "inherit",
        transition: "all 0.2s",
        whiteSpace: "nowrap",
        animation: isRecording
          ? "micPulse 1.5s ease-in-out infinite"
          : isTranscribing
          ? "micTranscribing 1s ease-in-out infinite"
          : "none",
      }}
    >
      {isTranscribing ? "···" : isRecording ? "●" : "🎤"}

      <style>{`
        @keyframes micPulse {
          0%, 100% { border-color: #553333; color: #aa4444; }
          50% { border-color: #773333; color: #cc5555; }
        }
        @keyframes micTranscribing {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </button>
  );
}
