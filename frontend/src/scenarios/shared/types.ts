// Shared types used across all scenario components.

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface VoiceConfig {
  voice_id: string;
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

export interface SessionState {
  exchangeCounter: number;         // 0 to exchange_limit
  history: ConversationMessage[];  // full history sent to backend each request
  isShutdown: boolean;             // true when exchangeCounter reaches exchange_limit
  isLoading: boolean;              // true while waiting for backend response
  voiceConfig: VoiceConfig | null; // loaded at init, held for all TTS calls
  ttsError: boolean;               // true if last TTS call failed
  exchangeLimit: number;           // loaded from init response
}
