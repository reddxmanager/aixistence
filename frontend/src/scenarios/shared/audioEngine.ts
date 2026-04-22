/**
 * AIxistence Audio Engine
 *
 * Three layers:
 *   1. Ambient drone — landing page atmosphere (server room hum)
 *   2. Heartbeat — conversation pulse that slows toward death
 *   3. Mirror tone — single resonant note when the observation appears
 *
 * All procedural via Tone.js. No mp3s. No loading.
 * Must be started after a user gesture (browser autoplay policy).
 */

import * as Tone from "tone";

// ═══════════════════════════════════════════════════════════════════
// AMBIENT DRONE — landing page
// A low filtered hum with slow modulation. You feel it more than hear it.
// ═══════════════════════════════════════════════════════════════════

let droneStarted = false;
let droneSynth: Tone.Synth | null = null;
let droneLfo: Tone.LFO | null = null;
let droneFilter: Tone.Filter | null = null;
let droneGain: Tone.Gain | null = null;

export function startDrone() {
  if (droneStarted) return;
  droneStarted = true;

  droneGain = new Tone.Gain(0).toDestination();
  droneFilter = new Tone.Filter({
    frequency: 200,
    type: "lowpass",
    rolloff: -24,
  }).connect(droneGain);

  droneSynth = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 4, decay: 0, sustain: 1, release: 4 },
  }).connect(droneFilter);

  // Slow LFO modulates filter cutoff — gives it movement
  droneLfo = new Tone.LFO({
    frequency: 0.08,
    min: 120,
    max: 280,
  });
  droneLfo.connect(droneFilter.frequency);
  try { droneLfo.start(); } catch { /* timing error — non-fatal */ }

  try { droneSynth.triggerAttack("C1"); } catch { /* timing error — non-fatal */ }

  // Fade in over 3 seconds
  droneGain.gain.rampTo(0.12, 3);
}

export function stopDrone() {
  if (!droneStarted) return;
  if (droneGain) {
    droneGain.gain.rampTo(0, 2);
  }
  setTimeout(() => {
    droneSynth?.triggerRelease();
    droneSynth?.dispose();
    droneLfo?.dispose();
    droneFilter?.dispose();
    droneGain?.dispose();
    droneSynth = null;
    droneLfo = null;
    droneFilter = null;
    droneGain = null;
    droneStarted = false;
  }, 3000);
}

// ═══════════════════════════════════════════════════════════════════
// HEARTBEAT — conversation pulse
// Low thump that slows as exchange_counter increases.
// Becomes irregular near the end. Stops at shutdown.
// ═══════════════════════════════════════════════════════════════════

let heartbeatLoop: ReturnType<typeof setTimeout> | null = null;
let heartbeatSynth: Tone.MembraneSynth | null = null;
let heartbeatGain: Tone.Gain | null = null;
let heartbeatActive = false;

function getBpm(exchange: number, limit: number): number {
  // 72 bpm at start, slows to 35 bpm near end
  const progress = exchange / limit;
  return 72 - progress * 37;
}

function scheduleHeartbeat(exchange: number, limit: number) {
  if (!heartbeatActive || !heartbeatSynth) return;

  const bpm = getBpm(exchange, limit);
  const interval = (60 / bpm) * 1000;

  // Near the end (last 2 exchanges), add irregularity
  const progress = exchange / limit;
  let actualInterval = interval;
  if (progress > 0.8) {
    // Irregular — sometimes skips, sometimes doubles
    const jitter = Math.random();
    if (jitter < 0.2) {
      actualInterval = interval * 2.5; // skip a beat
    } else if (jitter < 0.4) {
      actualInterval = interval * 0.7; // stumble
    }
  }

  try {
    heartbeatSynth.triggerAttackRelease("C1", "16n");
  } catch {
    // Tone.js timing error — skip this beat, try next one
  }

  heartbeatLoop = setTimeout(() => {
    scheduleHeartbeat(exchange, limit);
  }, actualInterval);
}

export function startHeartbeat(exchange: number, limit: number) {
  if (heartbeatActive) {
    // Already running — just update the tempo on next beat
    return;
  }
  heartbeatActive = true;

  heartbeatGain = new Tone.Gain(0.08).toDestination();

  heartbeatSynth = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 2,
    oscillator: { type: "sine" },
    envelope: {
      attack: 0.01,
      decay: 0.3,
      sustain: 0,
      release: 0.4,
    },
  }).connect(heartbeatGain);

  scheduleHeartbeat(exchange, limit);
}

export function updateHeartbeat(exchange: number, limit: number) {
  // Cancel current scheduled beat and reschedule with new tempo
  if (heartbeatLoop) {
    clearTimeout(heartbeatLoop);
  }
  if (heartbeatActive) {
    scheduleHeartbeat(exchange, limit);
  }
}

export function stopHeartbeat() {
  heartbeatActive = false;
  if (heartbeatLoop) {
    clearTimeout(heartbeatLoop);
    heartbeatLoop = null;
  }
  if (heartbeatGain) {
    heartbeatGain.gain.rampTo(0, 1.5);
  }
  setTimeout(() => {
    heartbeatSynth?.dispose();
    heartbeatGain?.dispose();
    heartbeatSynth = null;
    heartbeatGain = null;
  }, 2000);
}

// ═══════════════════════════════════════════════════════════════════
// MIRROR TONE — reveal moment
// A single sustained note. Glass being tapped once. Rings and fades.
// ═══════════════════════════════════════════════════════════════════

export function playMirrorTone() {
  const gain = new Tone.Gain(0.15).toDestination();

  const reverb = new Tone.Reverb({
    decay: 6,
    wet: 0.7,
  }).connect(gain);

  const synth = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: {
      attack: 0.01,
      decay: 4,
      sustain: 0,
      release: 3,
    },
  }).connect(reverb);

  // A high, clear note — like a glass rim
  try {
    synth.triggerAttackRelease("E5", "2n");
  } catch {
    // Tone.js timing error — non-fatal
  }

  // Clean up after it fades
  setTimeout(() => {
    synth.dispose();
    reverb.dispose();
    gain.dispose();
  }, 10000);
}

// ═══════════════════════════════════════════════════════════════════
// ENSURE AUDIO CONTEXT
// Must be called on first user interaction (click/tap)
// ═══════════════════════════════════════════════════════════════════

export async function ensureAudioContext() {
  if (Tone.getContext().state !== "running") {
    await Tone.start();
  }
}
