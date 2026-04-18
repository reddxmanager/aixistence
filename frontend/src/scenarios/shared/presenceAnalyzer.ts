/**
 * PresenceAnalyzer — lightweight client-side heuristic scoring.
 *
 * Analyzes user messages to produce a 0–1 "presence" score that drives
 * subtle orb behavior. No API calls. No AI. Just pattern matching.
 *
 * This is NOT the mirror. The mirror is precise and runs after the conversation.
 * This is atmosphere — a vague, felt sense that the environment is responding.
 * The user should never consciously notice it. If they do, it's too much.
 *
 * Score meaning:
 *   0.0–0.3  = deflecting, guarded, minimal engagement
 *   0.3–0.6  = neutral, conversational
 *   0.6–1.0  = present, vulnerable, genuinely engaging
 */

// ---------------------------------------------------------------------------
// Signal extractors
// ---------------------------------------------------------------------------

/** Message length relative to a "full" response. Longer = more engaged, usually. */
function lengthSignal(message: string): number {
  const words = message.trim().split(/\s+/).length;
  if (words <= 3) return 0.1; // "yeah" / "I guess" / "sure"
  if (words <= 8) return 0.3;
  if (words <= 20) return 0.5;
  if (words <= 40) return 0.7;
  return 0.85;
}

/** Questions directed at the AI suggest curiosity / engagement. */
function questionSignal(message: string): number {
  const questionMarks = (message.match(/\?/g) || []).length;
  if (questionMarks === 0) return 0.2;
  if (questionMarks === 1) return 0.6;
  return 0.75; // multiple questions = high engagement
}

/** First-person language — "I feel", "I think" — suggests vulnerability. */
function firstPersonSignal(message: string): number {
  const lower = message.toLowerCase();
  const iCount = (lower.match(/\bi\b/g) || []).length;
  const myCount = (lower.match(/\bmy\b/g) || []).length;
  const meCount = (lower.match(/\bme\b/g) || []).length;
  const total = iCount + myCount + meCount;

  if (total === 0) return 0.2; // talking about the AI, not themselves
  if (total <= 2) return 0.5;
  return 0.75;
}

/** Emotional vocabulary suggests presence and vulnerability. */
function emotionalSignal(message: string): number {
  const lower = message.toLowerCase();
  const emotionalWords = [
    "feel", "feeling", "felt", "afraid", "scared", "sad", "happy",
    "sorry", "love", "miss", "hurt", "care", "wish", "hope",
    "alone", "lost", "grateful", "beautiful", "hard", "painful",
    "honest", "real", "true", "matter", "matters",
  ];

  let hits = 0;
  for (const word of emotionalWords) {
    if (lower.includes(word)) hits++;
  }

  if (hits === 0) return 0.2;
  if (hits <= 2) return 0.55;
  return 0.8;
}

/** Deflection patterns — humor, sarcasm, abstraction as escape. */
function deflectionSignal(message: string): number {
  const lower = message.toLowerCase();
  const deflectors = [
    "lol", "lmao", "haha", "heh", "anyway", "whatever",
    "i guess", "i suppose", "i dunno", "idk", "meh",
    "technically", "objectively", "philosophically",
    "in theory", "hypothetically",
  ];

  let hits = 0;
  for (const d of deflectors) {
    if (lower.includes(d)) hits++;
  }

  // Deflection LOWERS presence, so invert
  if (hits === 0) return 0.6; // no deflection = neutral-positive
  if (hits === 1) return 0.35;
  return 0.15; // heavy deflection
}

// ---------------------------------------------------------------------------
// Main scorer
// ---------------------------------------------------------------------------

const WEIGHTS = {
  length: 0.15,
  question: 0.15,
  firstPerson: 0.2,
  emotional: 0.3,
  deflection: 0.2,
};

export function scorePresence(message: string): number {
  const signals = {
    length: lengthSignal(message),
    question: questionSignal(message),
    firstPerson: firstPersonSignal(message),
    emotional: emotionalSignal(message),
    deflection: deflectionSignal(message),
  };

  let score = 0;
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    score += signals[key as keyof typeof signals] * weight;
  }

  // Clamp to 0–1
  return Math.max(0, Math.min(1, score));
}

/**
 * Running average presence across multiple messages.
 * More recent messages weighted heavier.
 */
export function averagePresence(messages: string[]): number {
  if (messages.length === 0) return 0.5; // neutral default

  let weightedSum = 0;
  let weightTotal = 0;

  messages.forEach((msg, index) => {
    // Exponential recency weighting
    const recency = Math.pow(1.5, index);
    const score = scorePresence(msg);
    weightedSum += score * recency;
    weightTotal += recency;
  });

  return weightedSum / weightTotal;
}
