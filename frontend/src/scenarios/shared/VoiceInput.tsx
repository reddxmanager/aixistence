/**
 * VoiceInput — mic button that uses browser Web Speech API for transcription.
 *
 * Zero API calls. Zero cost. Works in Chrome and Safari.
 * Transcribes speech to text and calls onTranscript with the result.
 * Auto-sends on silence if autoSend is true.
 *
 * Falls back gracefully — if the browser doesn't support it, the button
 * simply doesn't render. Nobody on Firefox loses anything; they just type.
 */

import { useState, useRef, useEffect } from "react";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  onAutoSend?: (text: string) => void;
  disabled?: boolean;
  autoSend?: boolean;
}

// Check browser support once
const SpeechRecognition =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

export default function VoiceInput({
  onTranscript,
  onAutoSend,
  disabled = false,
  autoSend = true,
}: VoiceInputProps) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef("");

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Don't render if browser doesn't support it — show a subtle hint for Firefox users
  if (!SpeechRecognition) {
    return (
      <span
        style={{
          fontSize: "11px",
          color: "#333344",
          fontFamily: "'Georgia', serif",
          fontStyle: "italic",
          alignSelf: "center",
          whiteSpace: "nowrap",
        }}
        title="Web Speech API not supported in this browser"
      >
        voice unavailable —{" "}
        <a
          href="https://www.google.com/chrome/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#444458", textDecoration: "underline" }}
        >
          try Chrome
        </a>
      </span>
    );
  }

  function startListening() {
    if (disabled || listening) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false; // stops on silence — this is the auto-send trigger
    recognition.maxAlternatives = 1;

    transcriptRef.current = "";

    recognition.onstart = () => {
      setListening(true);
    };

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      // Show interim results as they come in
      const current = final || interim;
      transcriptRef.current = current;
      onTranscript(current);
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;

      // Auto-send on silence if we got a transcript
      const finalText = transcriptRef.current.trim();
      if (finalText && autoSend && onAutoSend) {
        onAutoSend(finalText);
      }
    };

    recognition.onerror = (event: any) => {
      // "no-speech" is normal — user clicked mic but didn't say anything
      if (event.error !== "no-speech") {
        console.error("Speech recognition error:", event.error);
      }
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function stopListening() {
    if (recognitionRef.current) {
      recognitionRef.current.stop(); // triggers onend -> auto-send
    }
  }

  function toggleListening() {
    if (listening) {
      stopListening();
    } else {
      startListening();
    }
  }

  return (
    <button
      onClick={toggleListening}
      disabled={disabled}
      aria-label={listening ? "Stop recording" : "Start recording"}
      style={{
        backgroundColor: "transparent",
        border: "1px solid",
        borderColor: disabled
          ? "#1a1a26"
          : listening
          ? "#553333"
          : "#2a2a44",
        borderRadius: "8px",
        color: disabled
          ? "#2a2a38"
          : listening
          ? "#aa4444"
          : "#7070aa",
        fontSize: "14px",
        padding: "10px 14px",
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "inherit",
        transition: "all 0.2s",
        whiteSpace: "nowrap",
        animation: listening ? "micPulse 1.5s ease-in-out infinite" : "none",
      }}
    >
      {listening ? "●" : "🎤"}

      <style>{`
        @keyframes micPulse {
          0%, 100% { border-color: #553333; color: #aa4444; }
          50% { border-color: #773333; color: #cc5555; }
        }
      `}</style>
    </button>
  );
}
