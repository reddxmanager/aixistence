/**
 * ScenarioPage — generic session manager for any AIxistence scenario.
 *
 * Takes a `scenarioId` prop and hits:
 *   POST /scenarios/{scenarioId}/init
 *   POST /scenarios/{scenarioId}/chat
 *
 * Opening lines are played from static audio files at:
 *   /audio/{scenarioId}-opening.mp3
 *
 * TTS via ElevenLabs is used only for conversation responses.
 *
 * All session state lives here. ConversationInterface handles the UI.
 *
 * Death sequence is choreographed through a single `deathPhase` state:
 *   "alive" → "dying" → "dark" → "mirror"
 * All triggered by one event: the final TTS finishing.
 */

import { useState, useEffect, useRef } from "react";
import type { ConversationMessage, VoiceConfig, SessionState } from "./types";
import ConversationInterface from "./ConversationInterface";
import MirrorReveal from "./MirrorReveal";
import { averagePresence } from "./presenceAnalyzer";
import {
  ensureAudioContext,
  startHeartbeat,
  updateHeartbeat,
  stopHeartbeat,
} from "./audioEngine";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE =
  (import.meta as unknown as { env: Record<string, string> }).env
    ?.VITE_API_URL ?? "http://localhost:8000";

const EXCHANGE_MARKER_RE = /\[Exchange\s+\d+\s+of\s+\d+\]/gi;

function stripExchangeMarker(text: string): string {
  return text.replace(EXCHANGE_MARKER_RE, "").trim();
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DeathPhase = "alive" | "dying" | "dark" | "mirror";

interface ScenarioPageProps {
  scenarioId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ScenarioPage({ scenarioId }: ScenarioPageProps) {
  const [state, setState] = useState<SessionState>({
    exchangeCounter: 0,
    history: [],
    isShutdown: false,
    isLoading: false,
    voiceConfig: null,
    ttsError: false,
    exchangeLimit: 10,
  });

  const [pendingTts, setPendingTts] = useState<string | null>(null);
  const [isPlayingOpening, setIsPlayingOpening] = useState(false);
  const [deathPhase, setDeathPhase] = useState<DeathPhase>("alive");
  const [presence, setPresence] = useState(0.5);

  const openingAudioRef = useRef<HTMLAudioElement | null>(null);

  // -------------------------------------------------------------------------
  // Mount: call /init, play static opening audio, add opening line to history
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    setState({
      exchangeCounter: 0,
      history: [],
      isShutdown: false,
      isLoading: false,
      voiceConfig: null,
      ttsError: false,
      exchangeLimit: 10,
    });
    setPendingTts(null);
    setIsPlayingOpening(false);
    setDeathPhase("alive");

    if (openingAudioRef.current) {
      openingAudioRef.current.pause();
      openingAudioRef.current = null;
    }

    async function init() {
      try {
        const res = await fetch(`${API_BASE}/scenarios/${scenarioId}/init`, {
          method: "POST",
        });

        if (!res.ok) {
          console.error("Init failed:", res.status);
          return;
        }

        const data: {
          opening_line: string;
          voice_config: VoiceConfig;
          exchange_limit: number;
        } = await res.json();

        if (cancelled) return;

        const openingMessage: ConversationMessage = {
          role: "assistant",
          content: stripExchangeMarker(data.opening_line),
        };

        setState((prev) => ({
          ...prev,
          voiceConfig: data.voice_config,
          exchangeLimit: data.exchange_limit,
          history: [openingMessage],
        }));

        const audio = new Audio(`/audio/${scenarioId}-opening.mp3`);
        openingAudioRef.current = audio;

        audio.addEventListener("play", () => {
          if (!cancelled) setIsPlayingOpening(true);
        });
        audio.addEventListener("ended", () => {
          if (!cancelled) setIsPlayingOpening(false);
        });
        audio.addEventListener("error", () => {
          if (!cancelled) setIsPlayingOpening(false);
        });

        audio.play().catch(() => {
          setIsPlayingOpening(false);
        });
      } catch (err) {
        if (!cancelled) {
          console.error("Init error:", err);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      if (openingAudioRef.current) {
        openingAudioRef.current.pause();
        openingAudioRef.current = null;
      }
    };
  }, [scenarioId]);

  // -------------------------------------------------------------------------
  // DEATH SEQUENCE — one choreographed flow
  //
  // Triggers when: isShutdown === true AND pendingTts cleared (TTS finished)
  // 
  // Timeline from TTS end:
  //   T+0.0s  "dying" — orb fades, heartbeat stops, text dims over 3.5s
  //   T+3.5s  "dark"  — pure black, silence sits
  //   T+5.5s  "mirror" — MirrorReveal mounts, tone + observation
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!state.isShutdown || deathPhase !== "alive") return;
    if (pendingTts !== null) return; // TTS still playing — wait

    // T+0: dying — orb fades, text dims over 2.5s
    setDeathPhase("dying");
    stopHeartbeat();

    // T+2.5s: pure darkness
    const darkTimer = setTimeout(() => {
      setDeathPhase("dark");
    }, 2500);

    // T+4s: mirror mounts
    const mirrorTimer = setTimeout(() => {
      setDeathPhase("mirror");
    }, 4000);

    return () => {
      clearTimeout(darkTimer);
      clearTimeout(mirrorTimer);
    };
  }, [state.isShutdown, pendingTts]); // NOTE: deathPhase intentionally excluded — including it cancels the timers

  // -------------------------------------------------------------------------
  // Heartbeat — starts on mount, updates each exchange
  // (stop is handled by death sequence, not by isShutdown directly)
  // -------------------------------------------------------------------------
  // Heartbeat starts when history first gets content (opening line loaded).
  // ensureAudioContext requires a prior user gesture — the orb click on the
  // landing page should have called it already.
  useEffect(() => {
    if (state.history.length > 0 && !state.isShutdown) {
      ensureAudioContext().then(() => {
        startHeartbeat(state.exchangeCounter, state.exchangeLimit);
      });
    }
  }, [state.history.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state.exchangeCounter > 0) {
      updateHeartbeat(state.exchangeCounter, state.exchangeLimit);
    }
  }, [state.exchangeCounter]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // onSubmit
  // -------------------------------------------------------------------------
  async function handleSubmit(message: string): Promise<void> {
    if (state.isShutdown || state.isLoading) return;

    const userMessage: ConversationMessage = { role: "user", content: message };

    setState((prev) => ({
      ...prev,
      history: [...prev.history, userMessage],
      isLoading: true,
      ttsError: false,
    }));

    const allUserMessages = [...state.history, userMessage]
      .filter((m) => m.role === "user")
      .map((m) => m.content);
    setPresence(averagePresence(allUserMessages));

    try {
      const res = await fetch(`${API_BASE}/scenarios/${scenarioId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: state.history,
          message,
          // Count only user messages — not the full history which includes
          // both user and assistant messages and inflates the counter by 2x
          exchange_counter: state.history.filter(m => m.role === "user").length,
        }),
      });

      if (res.status === 410) {
        setState((prev) => ({ ...prev, isShutdown: true, isLoading: false }));
        return;
      }

      if (res.status === 502 || !res.ok) {
        setState((prev) => ({
          ...prev,
          history: prev.history.slice(0, -1),
          isLoading: false,
        }));
        return;
      }

      const data: {
        response_text: string;
        exchange_counter: number;
        shutdown: boolean;
      } = await res.json();

      const assistantMessage: ConversationMessage = {
        role: "assistant",
        content: stripExchangeMarker(data.response_text),
      };

      setState((prev) => ({
        ...prev,
        history: [...prev.history, assistantMessage],
        exchangeCounter: data.exchange_counter,
        isShutdown: data.shutdown,
        isLoading: false,
      }));

      // Set pendingTts immediately — no delay. A 200ms gap between
      // isShutdown=true and pendingTts being set was causing the death
      // sequence to fire before TTS even started.
      setPendingTts(assistantMessage.content);
    } catch (err) {
      console.error("Chat error:", err);
      setState((prev) => ({
        ...prev,
        history: prev.history.slice(0, -1),
        isLoading: false,
      }));
    }
  }

  // -------------------------------------------------------------------------
  // onTtsError
  // -------------------------------------------------------------------------
  function handleTtsError() {
    setState((prev) => ({ ...prev, ttsError: true }));
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div style={{ backgroundColor: '#0a0a0e', minHeight: '100vh', position: 'relative' }}>
      <ConversationInterface
        history={state.history}
        exchangeCounter={state.exchangeCounter}
        exchangeLimit={state.exchangeLimit}
        isShutdown={state.isShutdown}
        isLoading={state.isLoading}
        voiceConfig={state.voiceConfig}
        ttsError={state.ttsError}
        scenarioId={scenarioId}
        presence={presence}
        deathPhase={deathPhase}
        pendingTts={pendingTts}
        onPendingTtsConsumed={() => setPendingTts(null)}
        onSubmit={handleSubmit}
        onTtsError={handleTtsError}
        isPlayingOpening={isPlayingOpening}
      />
      {deathPhase === "mirror" && (
        <MirrorReveal
          history={state.history}
          scenarioId={scenarioId}
        />
      )}
    </div>
  );
}
