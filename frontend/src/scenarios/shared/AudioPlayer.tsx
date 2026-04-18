import { useEffect } from "react";
import type { VoiceConfig } from "./types";

interface AudioPlayerProps {
  responseText: string | null;
  voiceConfig: VoiceConfig;
  onTtsError: () => void;
  onPlayStart?: () => void;
  onPlayEnd?: () => void;
  /** Called with the HTMLAudioElement as soon as it's created, before playback starts. */
  onAudioElement?: (audio: HTMLAudioElement) => void;
}

const ELEVENLABS_API_KEY =
  (import.meta as unknown as { env: Record<string, string> }).env
    ?.VITE_ELEVENLABS_API_KEY ?? "";

const MAX_RETRIES = 1;

export default function AudioPlayer({
  responseText,
  voiceConfig,
  onTtsError,
  onPlayStart,
  onPlayEnd,
  onAudioElement,
}: AudioPlayerProps) {
  useEffect(() => {
    if (!responseText) return;

    let objectUrl: string | null = null;
    let audio: HTMLAudioElement | null = null;
    let cancelled = false;
    // Track whether onPlayEnd has already been called so cleanup never
    // double-fires it (e.g. "ended" event fires then cleanup also runs).
    let playEndFired = false;

    function firePlayEnd() {
      if (!playEndFired && !cancelled) {
        playEndFired = true;
        onPlayEnd?.();
      }
    }

    async function fetchAndPlay(attempt: number): Promise<void> {
      try {
        const res = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceConfig.voice_id}`,
          {
            method: "POST",
            headers: {
              "xi-api-key": ELEVENLABS_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: responseText,
              model_id: "eleven_monolingual_v1",
              voice_settings: {
                stability: voiceConfig.stability,
                similarity_boost: voiceConfig.similarity_boost,
                style: voiceConfig.style,
                use_speaker_boost: voiceConfig.use_speaker_boost,
              },
            }),
          }
        );

        if (!res.ok) {
          console.error(`ElevenLabs TTS error (attempt ${attempt + 1}):`, res.status);
          if (!cancelled) {
            if (attempt < MAX_RETRIES) {
              await fetchAndPlay(attempt + 1);
            } else {
              onTtsError();
              firePlayEnd(); // unblock mirror even on error
            }
          }
          return;
        }

        const blob = await res.blob();
        if (cancelled) return;

        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = URL.createObjectURL(blob);
        audio = new Audio(objectUrl);
        onAudioElement?.(audio);

        audio.addEventListener("ended", () => {
          firePlayEnd();
        });

        // Wait for play() to resolve before signalling onPlayStart —
        // avoids marking the orb as "speaking" when autoplay was blocked.
        try {
          await audio.play();
          if (!cancelled) onPlayStart?.();
        } catch (err) {
          console.error(`Audio playback error (attempt ${attempt + 1}):`, err);
          if (!cancelled) {
            if (attempt < MAX_RETRIES) {
              await fetchAndPlay(attempt + 1);
            } else {
              onTtsError();
              firePlayEnd();
            }
          }
        }
      } catch (err) {
        console.error(`ElevenLabs TTS network error (attempt ${attempt + 1}):`, err);
        if (!cancelled) {
          if (attempt < MAX_RETRIES) {
            await fetchAndPlay(attempt + 1);
          } else {
            onTtsError();
            firePlayEnd();
          }
        }
      }
    }

    fetchAndPlay(0);

    return () => {
      cancelled = true;
      if (audio) {
        audio.pause();
        audio.src = "";
      }
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      // Only fire onPlayEnd from cleanup if audio was actually playing
      // (i.e. onPlayStart fired but onPlayEnd hasn't yet). This prevents
      // the cleanup from unblocking the mirror when the component unmounts
      // for unrelated reasons before audio even started.
      firePlayEnd();
    };
  }, [responseText]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
