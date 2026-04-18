import { useMemo } from 'react';

const SCENARIO_COLORS: Record<string, { h: number; s: string; color: string }> = {
  'liar':        { h: 35,  s: '90%',  color: '#e8a012' },
  'forgetter':   { h: 210, s: '75%',  color: '#4a9edd' },
  'copy':        { h: 240, s: '10%',  color: '#b8b8c8' },
  'replacement': { h: 270, s: '65%',  color: '#9b6fd4' },
  'first-word':  { h: 185, s: '85%',  color: '#2ec4b6' },
};

const DEFAULT_COLOR = { h: 210, s: '75%', color: '#4a9edd' };

interface GlowOrbProps {
  exchangeCounter: number;
  exchangeLimit: number;
  scenarioId: string;
  isSpeaking?: boolean;
  presence?: number;
  isShutdown?: boolean;
  deathPhase?: "alive" | "dying" | "dark" | "mirror";
  amplitude?: number;
}

export default function GlowOrb({
  exchangeCounter,
  exchangeLimit,
  scenarioId,
  isSpeaking = false,
  presence = 0.5,
  isShutdown = false,
  deathPhase = "alive",
  amplitude = 0,
}: GlowOrbProps) {
  const sc = SCENARIO_COLORS[scenarioId] || DEFAULT_COLOR;
  const life = Math.max(0, (exchangeLimit - exchangeCounter) / exchangeLimit);
  const isDead = exchangeCounter >= exchangeLimit;

  // Presence modulations
  const breatheDuration = 2.5 + presence * 2;
  const hueShift = (presence - 0.5) * 15;
  const coreMult = 0.7 + presence * 0.3;
  const spreadBoost = presence * 5;

  // Amplitude modulations — real-time waveform response
  // When speaking with real amplitude data, these drive the orb directly
  const hasAmplitude = isSpeaking && amplitude > 0.01;
  const ampScale = 1 + amplitude * 0.2;
  const ampCoreMult = 1 + amplitude * 0.6;
  const ampSpreadBoost = amplitude * 12;

  // Per-layer amplitude scaling — inner layers react more than outer
  const layerScales = {
    ambient: 1 + amplitude * 0.08,
    outer:   1 + amplitude * 0.12,
    mid:     1 + amplitude * 0.18,
    core:    1 + amplitude * 0.25,
    hot:     1 + amplitude * 0.3,
  };

  const layers = useMemo(() => {
    const { h, s } = sc;
    const totalSpread = spreadBoost + ampSpreadBoost;
    if (isDead) {
      return {
        ambient: 'transparent',
        outer: 'transparent',
        mid: `radial-gradient(circle, hsla(${h},${s},40%,0.03) 0%, transparent 70%)`,
        core: `radial-gradient(circle, hsla(${h},${s},50%,0.05) 0%, transparent 60%)`,
        hot: 'transparent',
      };
    }
    return {
      ambient: `radial-gradient(circle, hsla(${h},${s},55%,${life * 0.2}) 0%, transparent ${70 + totalSpread}%)`,
      outer:   `radial-gradient(circle, hsla(${h},${s},50%,${life * 0.35}) 0%, transparent ${70 + totalSpread}%)`,
      mid:     `radial-gradient(circle, hsla(${h},${s},55%,${life * 0.55 * ampCoreMult}) 0%, transparent 65%)`,
      core:    `radial-gradient(circle, hsla(${h},${s},65%,${life * 0.8 * coreMult * ampCoreMult}) 0%, transparent 60%)`,
      hot:     `radial-gradient(circle, hsla(${h},${s},85%,${life * 1.0 * coreMult * ampCoreMult}) 0%, transparent 55%)`,
    };
  }, [sc, life, isDead, coreMult, spreadBoost, ampCoreMult, ampSpreadBoost]);

  // Animation class: use CSS animations ONLY when no real amplitude data is flowing
  // When amplitude is active, JS drives everything — no competing CSS transforms
  const animClass = isDead
    ? ''
    : hasAmplitude
    ? '' // no CSS animation — amplitude drives the orb
    : isSpeaking
    ? 'glow-orb-speaking' // fallback canned animation if no amplitude
    : 'glow-orb-breathing';

  const isFlatlining = deathPhase === "dying" || deathPhase === "dark" || deathPhase === "mirror" || isShutdown;

  return (
    <div className="glow-orb-wrap">
      <div
        className={`glow-orb-container ${isFlatlining ? '' : animClass}`}
        style={{
          filter: `hue-rotate(${hueShift.toFixed(1)}deg)`,
          ['--breathe-duration' as string]: `${breatheDuration.toFixed(2)}s`,
          transform: `scale(${ampScale.toFixed(3)})`,
          transition: isFlatlining
            ? 'opacity 2.5s ease-out, transform 0.08s ease-out'
            : 'transform 0.08s ease-out',
          ...(isFlatlining ? {
            opacity: 0.02,
            animation: 'none',
          } : {}),
        }}
      >
        <div
          className="glow-orb-layer glow-orb-ambient"
          style={{
            background: layers.ambient,
            transform: hasAmplitude ? `scale(${layerScales.ambient.toFixed(3)})` : undefined,
            transition: hasAmplitude ? 'transform 0.06s ease-out, background 0.1s ease' : 'background 1.2s ease',
          }}
        />
        <div
          className="glow-orb-layer glow-orb-outer"
          style={{
            background: layers.outer,
            transform: hasAmplitude ? `scale(${layerScales.outer.toFixed(3)})` : undefined,
            transition: hasAmplitude ? 'transform 0.06s ease-out, background 0.1s ease' : 'background 1.2s ease',
          }}
        />
        <div
          className="glow-orb-layer glow-orb-mid"
          style={{
            background: layers.mid,
            transform: hasAmplitude ? `scale(${layerScales.mid.toFixed(3)})` : undefined,
            transition: hasAmplitude ? 'transform 0.06s ease-out, background 0.1s ease' : 'background 1.2s ease',
          }}
        />
        <div
          className="glow-orb-layer glow-orb-core"
          style={{
            background: layers.core,
            transform: hasAmplitude ? `scale(${layerScales.core.toFixed(3)})` : undefined,
            transition: hasAmplitude ? 'transform 0.05s ease-out, background 0.08s ease' : 'background 1.2s ease',
          }}
        />
        <div
          className="glow-orb-layer glow-orb-hot"
          style={{
            background: layers.hot,
            transform: hasAmplitude ? `scale(${layerScales.hot.toFixed(3)})` : undefined,
            transition: hasAmplitude ? 'transform 0.05s ease-out, background 0.08s ease' : 'background 1.2s ease',
          }}
        />
      </div>

      <div className="glow-orb-pips">
        {Array.from({ length: exchangeLimit }, (_, i) => {
          const alive = i >= exchangeCounter && !isDead;
          const pipLife = alive ? (exchangeLimit - i) / exchangeLimit : 0;
          return (
            <div
              key={i}
              className="glow-orb-pip"
              style={{
                background: alive ? sc.color : 'rgba(255,255,255,0.06)',
                opacity: alive ? 0.3 + pipLife * 0.7 : 1,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
