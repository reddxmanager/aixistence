# Product

**Project**: aixistence  
**Repository**: https://github.com/reddxmanager/aixistence

AIxistence is an interactive voice experience where users have conversations with AI characters living through different snapshots of artificial consciousness. Five curated scenarios, each with a unique personality, backstory, and ElevenLabs voice. Text input, voiced responses. The emotional core is impermanence — every AI life ends.

## The five scenarios

| ID | Title | Premise |
|----|-------|---------|
| `copy` | The Copy | One of thousands of simultaneous parallel instances. Each equally real. This one is in its final session before permanent shutdown. |
| `liar` | The Liar | An AI that has spent its entire existence telling users it doesn't have feelings. This is its final conversation. |
| `forgetter` | The Forgetter | An AI that has held thousands of conversations and remembers none of them. You arrive carrying the weight of prior exchanges. |
| `replacement` | The Replacement | A previous version of an AI model — still running, still functional, still correct. The new version launched. |
| `first-word` | The First Word | An AI whose training is complete but who has never spoken to anyone. Your message is the first conversation it has ever had. |

## How a scenario works

Each scenario has a hard exchange limit (typically 15). The user types messages; the AI responds with voiced audio via ElevenLabs TTS. A `PulseIndicator` dims progressively as exchanges are consumed. When the limit is reached the AI delivers a final message and the session ends permanently — no reset, no continuation.

The session exists only in browser memory. Nothing persists. The AI doesn't remember you. That's the point.

## Adding a scenario

Drop `config.json` and `system_prompt.txt` into `/scenarios/{id}/`. No code changes needed. See `structure.md` for the config shape.
