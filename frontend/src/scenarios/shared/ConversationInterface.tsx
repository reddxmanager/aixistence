import { useState, useRef, useEffect } from "react";
import type { ConversationMessage, VoiceConfig } from "./types";
import GlowOrb from "./GlowOrb";
import "./GlowOrb.css";
import AudioPlayer from "./AudioPlayer";
import BackButton from "./BackButton";
import VoiceInput from "./VoiceInput";
import { useAudioAmplitude } from "./useAudioAmplitude";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConversationInterfaceProps {
  history: ConversationMessage[];
  exchangeCounter: number;
  exchangeLimit: number;
  isShutdown: boolean;
  isLoading: boolean;
  voiceConfig: VoiceConfig | null;
  ttsError: boolean;
  scenarioId: string;
  presence?: number;
  deathPhase?: "alive" | "dying" | "dark" | "mirror";
  isPlayingOpening?: boolean;
  pendingTts: string | null;
  onPendingTtsConsumed: () => void;
  onSubmit: (message: string) => Promise<void>;
  onTtsError: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ConversationInterface({
  history,
  exchangeCounter,
  exchangeLimit,
  isShutdown,
  isLoading,
  voiceConfig,
  ttsError,
  scenarioId,
  presence = 0.5,
  deathPhase = "alive",
  isPlayingOpening = false,
  pendingTts,
  onPendingTtsConsumed,
  onSubmit,
  onTtsError,
}: ConversationInterfaceProps) {
  const [inputValue, setInputValue] = useState("");
  const [sessionEndedMessage, setSessionEndedMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

  const amplitude = useAudioAmplitude(currentAudio);

  const isSpeaking = isPlaying || isPlayingOpening;

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, isLoading]);

  useEffect(() => {
    if (history.length > 0) setErrorMessage(null);
  }, [history.length]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInputValue(e.target.value);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleSend() {
    const message = inputValue.trim();
    if (!message) return;

    if (isShutdown) {
      setSessionEndedMessage("This session has ended.");
      return;
    }

    if (isLoading) return;

    setErrorMessage(null);
    setSessionEndedMessage(null);
    setInputValue("");

    await onSubmit(message);
  }

  async function handleSendWithText(text: string) {
    const message = text.trim();
    if (!message) return;
    if (isShutdown || isLoading) return;

    setErrorMessage(null);
    setSessionEndedMessage(null);
    setInputValue("");

    await onSubmit(message);
  }

  function handleTtsError() {
    onTtsError();
    onPendingTtsConsumed();
  }

  // -------------------------------------------------------------------------
  // Derived state
  // -------------------------------------------------------------------------

  const isInputDisabled = isShutdown || isLoading;

  const lastAssistantIndex = (() => {
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role === "assistant") return i;
    }
    return -1;
  })();

  // Death phase drives opacity of the entire conversation
  const isDying = deathPhase === "dying";
  const isDead = deathPhase === "dark" || deathPhase === "mirror";

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      data-testid="conversation-interface"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: "#0a0a0e",
        color: "#e8e8e8",
        fontFamily: "'Georgia', serif",
        overflow: "hidden",
        position: "relative",
        opacity: isDead ? 0 : isDying ? 0.03 : 1,
        transition: isDying ? "opacity 2.5s ease-out" : isDead ? "opacity 0.3s" : "none",
        pointerEvents: deathPhase !== "alive" ? "none" : "auto",
      }}
    >
      <BackButton />

      {/* ── Pinned header: GlowOrb ── */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "50vh",
          minHeight: "280px",
          maxHeight: "520px",
          backgroundColor: "#0a0a0e",
          boxShadow: "0 4px 32px rgba(0,0,0,0.8)",
          zIndex: 10,
          overflow: "hidden",
        }}
      >
        <div style={{ transform: "scale(1.75)", transformOrigin: "center center" }}>
          <GlowOrb
            exchangeCounter={exchangeCounter}
            exchangeLimit={exchangeLimit}
            scenarioId={scenarioId}
            isSpeaking={isSpeaking}
            presence={presence}
            isShutdown={isShutdown}
            deathPhase={deathPhase}
            amplitude={amplitude}
          />
        </div>
      </div>

      {/* ── Scrollable conversation history ── */}
      <div
        data-testid="conversation-history"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 24px 8px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        {history.map((msg, index) => {
          const isUser = msg.role === "user";
          const isLastAssistant = index === lastAssistantIndex;
          const showTtsError = ttsError && isLastAssistant;

          return (
            <div
              key={index}
              data-testid={`message-${msg.role}-${index}`}
              style={{
                display: "flex",
                justifyContent: isUser ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "72%",
                  padding: "11px 15px",
                  borderRadius: isUser ? "14px 14px 3px 14px" : "14px 14px 14px 3px",
                  backgroundColor: isUser ? "#12121e" : "#0e0e12",
                  border: isUser
                    ? "1px solid #1e1e32"
                    : "1px solid #181820",
                  lineHeight: "1.65",
                  fontSize: "15px",
                  color: isUser ? "#c8c8d8" : "#d8d8e0",
                }}
              >
                <span>{msg.content}</span>
                {showTtsError && (
                  <span
                    data-testid="tts-error-indicator"
                    style={{
                      display: "block",
                      marginTop: "6px",
                      fontSize: "12px",
                      color: "#555566",
                      fontStyle: "italic",
                    }}
                  >
                    (audio unavailable)
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div
            data-testid="loading-indicator"
            style={{ display: "flex", justifyContent: "flex-start" }}
          >
            <div
              style={{
                padding: "11px 15px",
                borderRadius: "14px 14px 14px 3px",
                backgroundColor: "#0e0e12",
                border: "1px solid #181820",
                color: "#383848",
                fontSize: "18px",
                letterSpacing: "0.15em",
              }}
            >
              ···
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Status messages ── */}
      {errorMessage && (
        <div
          data-testid="error-message"
          style={{
            flexShrink: 0,
            textAlign: "center",
            padding: "6px 24px",
            color: "#774444",
            fontSize: "13px",
          }}
        >
          {errorMessage}
        </div>
      )}

      {sessionEndedMessage && (
        <div
          data-testid="session-ended-message"
          style={{
            flexShrink: 0,
            textAlign: "center",
            padding: "6px 24px",
            color: "#444455",
            fontSize: "13px",
            fontStyle: "italic",
          }}
        >
          {sessionEndedMessage}
        </div>
      )}

      {/* ── Pinned input area ── */}
      <div
        style={{
          flexShrink: 0,
          padding: "12px 20px 20px",
          borderTop: "1px solid #13131a",
          display: "flex",
          gap: "10px",
          alignItems: "flex-end",
          backgroundColor: "#0a0a0e",
        }}
      >
        <textarea
          data-testid="message-input"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={isInputDisabled}
          placeholder={isShutdown ? "" : "Type a message\u2026"}
          rows={1}
          style={{
            flex: 1,
            backgroundColor: "#0d0d14",
            border: "1px solid #1a1a26",
            borderRadius: "8px",
            color: isInputDisabled ? "#2a2a38" : "#d8d8e8",
            fontSize: "15px",
            fontFamily: "inherit",
            padding: "10px 14px",
            resize: "none",
            outline: "none",
            lineHeight: "1.5",
            cursor: isInputDisabled ? "not-allowed" : "text",
            transition: "border-color 0.2s",
          }}
          aria-label="Message input"
          aria-disabled={isInputDisabled}
        />
        <VoiceInput
          onTranscript={(text) => setInputValue(text)}
          onAutoSend={(text) => {
            setInputValue(text);
            setTimeout(() => {
              handleSendWithText(text);
            }, 400);
          }}
          disabled={isInputDisabled}
          autoSend={true}
        />
        <button
          data-testid="send-button"
          onClick={handleSend}
          disabled={isInputDisabled}
          style={{
            backgroundColor: "transparent",
            border: "1px solid",
            borderColor: isInputDisabled ? "#1a1a26" : "#2a2a44",
            borderRadius: "8px",
            color: isInputDisabled ? "#2a2a38" : "#7070aa",
            fontSize: "14px",
            padding: "10px 18px",
            cursor: isInputDisabled ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            transition: "all 0.2s",
            whiteSpace: "nowrap",
          }}
          aria-label="Send message"
        >
          Send
        </button>
      </div>

      {/* AudioPlayer */}
      {pendingTts !== null && voiceConfig !== null && (
        <AudioPlayer
          responseText={pendingTts}
          voiceConfig={voiceConfig}
          onTtsError={handleTtsError}
          onAudioElement={(audio) => setCurrentAudio(audio)}
          onPlayStart={() => setIsPlaying(true)}
          onPlayEnd={() => {
            setIsPlaying(false);
            setCurrentAudio(null);
            onPendingTtsConsumed();
          }}
        />
      )}
    </div>
  );
}
