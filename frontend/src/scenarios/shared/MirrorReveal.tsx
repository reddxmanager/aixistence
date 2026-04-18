/**
 * MirrorReveal — the complete post-death experience.
 *
 * By the time this mounts, the conversation has already faded and
 * 2 seconds of darkness have passed (handled by ScenarioPage's deathPhase).
 *
 * Flow:
 *   1. API call fires immediately on mount
 *   2. Brief breathing dots while waiting (800ms minimum)
 *   3. Glass tone rings in silence
 *   4. 1.2s later, observation emerges with letter-spacing tightening
 *   5. "leave yours on the wall" / "forget this happened"
 *   6. "noted." or "forgotten." → navigate home
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { ConversationMessage } from "./types";
import { playMirrorTone } from "./audioEngine";

const API_BASE =
  (import.meta as unknown as { env: Record<string, string> }).env
    ?.VITE_API_URL ?? "http://localhost:8000";

type Phase = "breathing" | "revealing" | "revealed" | "departing" | "error";

interface MirrorRevealProps {
  history: ConversationMessage[];
  scenarioId: string;
}

export default function MirrorReveal({ history, scenarioId }: MirrorRevealProps) {
  const navigate = useNavigate();

  const [observation, setObservation] = useState<string | null>(null);
  const [mirrorId, setMirrorId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("breathing");
  const [addedToWall, setAddedToWall] = useState(false);
  const mountTime = useRef(Date.now());

  // ── Fetch mirror analysis — fires IMMEDIATELY, reveals after minimum wait ──
  useEffect(() => {
    let cancelled = false;
    mountTime.current = Date.now();

    const fetchPromise = fetch(`${API_BASE}/mirror/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history, scenario_id: scenarioId }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);

    fetchPromise.then((data) => {
      if (cancelled) return;

      if (!data) {
        setPhase("error");
        return;
      }

      setObservation(data.observation);
      setMirrorId(data.mirror_id);

      // Ensure minimum 800ms breathing time even if API was fast
      const elapsed = Date.now() - mountTime.current;
      const remaining = Math.max(0, 800 - elapsed);

      setTimeout(() => {
        if (cancelled) return;

        // Tone rings first — in the silence
        playMirrorTone();

        // Text emerges 1.2s after the tone
        setTimeout(() => {
          if (cancelled) return;
          setPhase("revealing");

          // Actions appear after emerge animation
          setTimeout(() => {
            if (!cancelled) setPhase("revealed");
          }, 3000);
        }, 1200);
      }, remaining);
    });

    return () => {
      cancelled = true;
    };
  }, [history, scenarioId]);

  // ── Add to wall ──
  async function handleAddToWall() {
    if (!observation || !mirrorId || addedToWall) return;
    try {
      await fetch(`${API_BASE}/mirror/wall`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mirror_id: mirrorId,
          observation,
          scenario_id: scenarioId,
        }),
      });
      setAddedToWall(true);
    } catch {
      /* silent */
    }
    depart();
  }

  function handleForget() {
    depart();
  }

  function depart() {
    setPhase("departing");
    setTimeout(() => {
      navigate("/");
    }, 3500);
  }

  function handleErrorReturn() {
    navigate("/");
  }

  // ── Render ──
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "#0a0a0e",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        zIndex: 250,
        animation: "mirrorFadeIn 1s ease-in-out",
      }}
    >
      {phase === "breathing" && (
        <div
          style={{
            display: "flex",
            gap: "10px",
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: "3px",
                height: "3px",
                borderRadius: "50%",
                backgroundColor: "#1e1e2e",
                animation: `mirrorDotPulse 1.8s ease-in-out ${i * 0.3}s infinite`,
              }}
            />
          ))}
        </div>
      )}

      {(phase === "revealing" || phase === "revealed") && observation && (
        <div
          style={{
            maxWidth: "560px",
            textAlign: "center",
            animation: "mirrorEmerge 3s ease-in-out forwards",
          }}
        >
          <p
            style={{
              color: "#c8c8d8",
              fontSize: "18px",
              fontFamily: "'Georgia', serif",
              lineHeight: "1.8",
              margin: 0,
            }}
          >
            {observation}
          </p>
        </div>
      )}

      {phase === "revealed" && (
        <div
          style={{
            marginTop: "60px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
            animation: "mirrorActionsAppear 1.5s ease-in-out forwards",
          }}
        >
          <button
            onClick={handleAddToWall}
            style={{
              background: "transparent",
              border: "1px solid #2a2a3a",
              borderRadius: "6px",
              color: "#555568",
              fontSize: "13px",
              fontFamily: "'Georgia', serif",
              padding: "10px 24px",
              cursor: "pointer",
              letterSpacing: "0.05em",
              transition: "all 0.3s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#3a3a50";
              e.currentTarget.style.color = "#7070aa";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#2a2a3a";
              e.currentTarget.style.color = "#555568";
            }}
          >
            leave yours on the wall
          </button>

          <button
            onClick={handleForget}
            style={{
              background: "transparent",
              border: "none",
              color: "#2a2a3a",
              fontSize: "12px",
              fontFamily: "'Georgia', serif",
              cursor: "pointer",
              letterSpacing: "0.08em",
              padding: "8px 16px",
              transition: "color 0.3s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#444458")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#2a2a3a")}
          >
            forget this happened
          </button>
        </div>
      )}

      {phase === "departing" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#0a0a0e",
            animation: "mirrorFadeIn 1s ease-in-out forwards",
          }}
        >
          <p
            style={{
              color: "#333344",
              fontSize: "14px",
              fontFamily: "'Georgia', serif",
              fontStyle: "italic",
              letterSpacing: "0.12em",
              animation: "mirrorThankYou 3s ease-in-out forwards",
            }}
          >
            {addedToWall ? "noted." : "forgotten."}
          </p>
        </div>
      )}

      {phase === "error" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "24px",
          }}
        >
          <p
            style={{
              color: "#333344",
              fontSize: "14px",
              fontFamily: "'Georgia', serif",
              fontStyle: "italic",
            }}
          >
            Some things resist reflection.
          </p>
          <button
            onClick={handleErrorReturn}
            style={{
              background: "transparent",
              border: "none",
              color: "#2a2a3a",
              fontSize: "12px",
              fontFamily: "'Georgia', serif",
              cursor: "pointer",
              letterSpacing: "0.08em",
              padding: "8px 16px",
              transition: "color 0.3s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#444458")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#2a2a3a")}
          >
            return
          </button>
        </div>
      )}

      <style>{`
        @keyframes mirrorFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes mirrorEmerge {
          0%   { opacity: 0; letter-spacing: 0.15em; }
          60%  { opacity: 0.4; letter-spacing: 0.06em; }
          100% { opacity: 1; letter-spacing: 0.02em; }
        }
        @keyframes mirrorActionsAppear {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes mirrorDotPulse {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50%      { opacity: 0.5;  transform: scale(1.4); }
        }
        @keyframes mirrorThankYou {
          0%   { opacity: 0; }
          30%  { opacity: 0.6; }
          70%  { opacity: 0.6; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
