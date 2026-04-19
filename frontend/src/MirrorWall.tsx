/**
 * MirrorWall — anonymous mirror observations that crawl across the screen.
 *
 * 5 lanes, each running one item at a time. On load, lanes are pre-positioned
 * at evenly spaced points mid-crossing so the screen looks full immediately.
 *
 * Visibility-aware: timers are paused when the tab is hidden and resumed with
 * the correct remaining time when the tab becomes visible again, preventing
 * observations from piling up after the user minimises the window.
 */

import { useState, useEffect, useRef } from "react";

const API_BASE =
  (import.meta as unknown as { env: Record<string, string> }).env
    ?.VITE_API_URL ?? "http://localhost:8000";

const SCENARIO_COLORS: Record<string, string> = {
  "liar":        "#c8880e",
  "forgetter":   "#3a8ecc",
  "copy":        "#9898a8",
  "replacement": "#8858c0",
  "first-word":  "#28b0a4",
  "indifferent": "#888888",
};
const DEFAULT_COLOR = "#666680";

interface WallEntry {
  mirror_id: string;
  observation: string;
  scenario_id: string;
  timestamp: number;
}

interface TickerItem {
  id: string;
  text: string;
  color: string;
  lane: number;
  duration: number;
  animationDelay: number;
}

// Per-lane timer state — enough to pause and resume correctly
interface LaneTimer {
  timerId: ReturnType<typeof setTimeout>;
  scheduledAt: number;   // performance.now() when the timer was set
  remaining: number;     // ms remaining when it was set
  callback: () => void;
}

const TICKER_ZONE_TOP    = 78;   // vh — just below the liar orb (~70% of lifeline wrap)
const TICKER_ZONE_HEIGHT = 18;   // vh — fills space to bottom edge
const LANES              = 5;
const CROSS_DURATION     = 50000;
const GAP_BETWEEN        = 3000;

export default function MirrorWall() {
  const [entries, setEntries] = useState<WallEntry[]>([]);
  const [items, setItems]     = useState<TickerItem[]>([]);
  const entryIndexRef         = useRef(0);
  const [isMobile]            = useState(() => window.innerWidth < 768);
  const [mobileEntry, setMobileEntry] = useState<WallEntry | null>(null);
  const [mobileVisible, setMobileVisible] = useState(true);

  // Visibility-aware timer registry
  const laneTimers = useRef<Partial<Record<number, LaneTimer>>>({});

  // ── Visibility-aware setTimeout ──
  // Stores enough state to cancel and re-schedule with the correct remaining
  // time when the tab becomes visible again.
  function setLaneTimer(lane: number, callback: () => void, delay: number) {
    // Cancel any existing timer for this lane
    const existing = laneTimers.current[lane];
    if (existing) clearTimeout(existing.timerId);

    const timerId = setTimeout(callback, delay);
    laneTimers.current[lane] = {
      timerId,
      scheduledAt: performance.now(),
      remaining: delay,
      callback,
    };
  }

  // ── Pause / resume on visibility change ──
  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden) {
        // Pause: record how much time was left for each lane timer
        for (const [, lt] of Object.entries(laneTimers.current)) {
          if (!lt) continue;
          clearTimeout(lt.timerId);
          const elapsed = performance.now() - lt.scheduledAt;
          lt.remaining = Math.max(0, lt.remaining - elapsed);
        }
      } else {
        // Resume: restart each lane timer with its remaining time
        for (const [laneStr, lt] of Object.entries(laneTimers.current)) {
          if (!lt) continue;
          const lane = Number(laneStr);
          const cb   = lt.callback;
          const rem  = lt.remaining;
          const timerId = setTimeout(cb, rem);
          laneTimers.current[lane] = {
            timerId,
            scheduledAt: performance.now(),
            remaining: rem,
            callback: cb,
          };
        }
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  // ── Fetch ──
  useEffect(() => {
    let cancelled = false;
    async function fetchWall() {
      try {
        const res = await fetch(`${API_BASE}/mirror/wall?limit=100`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        const fetched: WallEntry[] = data.entries || [];
        if (fetched.length === 0) return;
        setEntries([...fetched].sort(() => Math.random() - 0.5));
      } catch { /* non-critical */ }
    }
    fetchWall();
    return () => { cancelled = true; };
  }, []);

  // ── Populate all lanes immediately on load ──
  useEffect(() => {
    if (entries.length === 0) return;
    if (isMobile) {
      // Mobile: just pick a random entry to show statically
      setMobileEntry(entries[Math.floor(Math.random() * entries.length)]);
      return;
    }

    for (let lane = 0; lane < LANES; lane++) {
      const progressFraction = lane / LANES;
      const negativeDelay    = -(progressFraction * CROSS_DURATION);
      launchInLane(lane, entries, negativeDelay);
    }

    return () => {
      for (const lt of Object.values(laneTimers.current)) {
        if (lt) clearTimeout(lt.timerId);
      }
    };
  }, [entries]); // eslint-disable-line react-hooks/exhaustive-deps

  function launchInLane(lane: number, pool: WallEntry[], animationDelay = 0) {
    if (pool.length === 0) return;

    const idx   = entryIndexRef.current % pool.length;
    entryIndexRef.current += 1;

    const entry  = pool[idx];
    const itemId = `lane${lane}-${Date.now()}`;
    const color  = SCENARIO_COLORS[entry.scenario_id] ?? DEFAULT_COLOR;

    setItems(prev => [...prev, {
      id: itemId,
      text: entry.observation,
      color,
      lane,
      duration: CROSS_DURATION,
      animationDelay,
    }]);

    // Remaining crossing time (negative delay means item is already mid-screen)
    const remainingTime = CROSS_DURATION + animationDelay;

    setLaneTimer(lane, () => {
      setItems(prev => prev.filter(i => i.id !== itemId));
      setLaneTimer(lane, () => launchInLane(lane, pool, 0), GAP_BETWEEN);
    }, remainingTime + 200);
  }

  // ── Mobile: cycle one observation every 8s with fade ──
  useEffect(() => {
    if (!isMobile || entries.length === 0) return;

    const cycle = setInterval(() => {
      setMobileVisible(false);
      setTimeout(() => {
        setMobileEntry(entries[entryIndexRef.current % entries.length]);
        entryIndexRef.current += 1;
        setMobileVisible(true);
      }, 800);
    }, 8000);

    return () => clearInterval(cycle);
  }, [isMobile, entries]); // eslint-disable-line react-hooks/exhaustive-deps

  if (entries.length === 0) return null;

  // ── Mobile render: single fading observation ──
  if (isMobile) {
    if (!mobileEntry) return null;
    return (
      <div
        style={{
          position: "fixed",
          bottom: "24px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(340px, 85vw)",
          textAlign: "center",
          pointerEvents: "none",
          zIndex: 4,
          opacity: mobileVisible ? 1 : 0,
          transition: "opacity 0.8s ease",
        }}
      >
        <p
          style={{
            color: SCENARIO_COLORS[mobileEntry.scenario_id] ?? DEFAULT_COLOR,
            fontSize: "12px",
            fontFamily: "'Georgia', serif",
            fontStyle: "italic",
            lineHeight: "1.6",
            margin: 0,
            opacity: 0.7,
          }}
        >
          {mobileEntry.observation}
        </p>
      </div>
    );
  }

  function laneTop(lane: number): string {
    return `${8 + (lane / (LANES - 1)) * 78}%`;
  }

  return (
    <>
      <div
        style={{
          position: "fixed",
          top: `${TICKER_ZONE_TOP}vh`,
          left: 0,
          right: 0,
          height: `${TICKER_ZONE_HEIGHT}vh`,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 4,
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)",
          maskImage:
            "linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)",
        }}
      >
        {items.map(item => (
          <div
            key={item.id}
            style={{
              position: "absolute",
              top: laneTop(item.lane),
              whiteSpace: "nowrap",
              color: item.color,
              fontSize: "13px",
              fontFamily: "'Georgia', serif",
              fontStyle: "italic",
              letterSpacing: "0.03em",
              animation: `mirrorCrawl ${item.duration}ms linear forwards`,
              animationDelay: `${item.animationDelay}ms`,
            }}
          >
            {item.text}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes mirrorCrawl {
          from { transform: translateX(105vw); }
          to   { transform: translateX(-105vw); }
        }
      `}</style>
    </>
  );
}
