/**
 * useAudioAmplitude — extracts real-time amplitude from an HTMLAudioElement.
 *
 * Returns a 0–1 amplitude value that updates every animation frame.
 * Designed to drive the GlowOrb's visual response to TTS playback.
 *
 * Usage:
 *   const amplitude = useAudioAmplitude(audioElement);
 *   <GlowOrb amplitude={amplitude} ... />
 */

import { useState, useEffect, useRef } from "react";

export function useAudioAmplitude(audioElement: HTMLAudioElement | null): number {
  const [amplitude, setAmplitude] = useState(0);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number>(0);
  const connectedElementRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioElement) {
      setAmplitude(0);
      return;
    }

    // Don't reconnect the same element — MediaElementSource can only be created once per element
    if (connectedElementRef.current === audioElement) return;

    // Clean up previous
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    // Create or reuse audio context
    if (!contextRef.current) {
      contextRef.current = new AudioContext();
    }
    const ctx = contextRef.current;

    // Create analyser
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    analyserRef.current = analyser;

    // Connect audio element to analyser
    try {
      const source = ctx.createMediaElementSource(audioElement);
      source.connect(analyser);
      analyser.connect(ctx.destination); // still plays through speakers
      sourceRef.current = source;
      connectedElementRef.current = audioElement;
    } catch (e) {
      // Element may already have a source — can only create one per element
      console.warn("Audio analyser connection failed:", e);
      return;
    }

    // Sample amplitude on each frame
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function sample() {
      if (!analyserRef.current) return;

      analyserRef.current.getByteFrequencyData(dataArray);

      // Average amplitude across frequency bins, normalized to 0–1
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length / 255;

      setAmplitude(avg);
      rafRef.current = requestAnimationFrame(sample);
    }

    sample();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setAmplitude(0);
    };
  }, [audioElement]);

  // Clean up everything on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // Don't close the audio context — it can be reused
    };
  }, []);

  return amplitude;
}
