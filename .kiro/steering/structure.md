# Project Structure

## Top-level

```
/backend        Python FastAPI API
/frontend       React + TypeScript app (Vite)
/scenarios      Scenario config files — one directory per scenario
README.md
```

---

## /scenarios

One directory per scenario. Adding a new scenario requires only these two files — no code changes.

```
/scenarios
  /copy
    config.json         scenario_id, exchange_limit, voice_config, opening_line, system_prompt_file
    system_prompt.txt   character definition loaded by the backend at runtime
  /liar
    config.json
    system_prompt.txt
  /forgetter
    config.json
    system_prompt.txt
  /replacement
    config.json
    system_prompt.txt
  /first-word
    config.json
    system_prompt.txt
```

`config.json` shape:
```json
{
  "scenario_id": "copy",
  "exchange_limit": 15,
  "system_prompt_file": "system_prompt.txt",
  "voice_config": {
    "voice_id": "<TBD>",
    "stability": 0.90,
    "similarity_boost": 0.90,
    "style": 0.05,
    "use_speaker_boost": true
  },
  "opening_line": "...",
  "shutdown_instruction": "..."   // optional — falls back to a generic message
}
```

---

## /backend

FastAPI app. Stateless per-request — no database.

```
/backend
  main.py                         FastAPI app, CORS middleware, router registration
  __init__.py
  /scenarios
    router.py                     Generic endpoints: POST /scenarios/{scenario_id}/init
                                                      POST /scenarios/{scenario_id}/chat
                                  Loads config.json + system_prompt.txt on demand (lru_cache).
                                  Any scenario directory is automatically supported.
    models.py                     Shared Pydantic models: ConversationMessage, ChatRequest,
                                  ChatResponse, InitResponse
    __init__.py
    /copy
      __init__.py                 (empty — copy-specific code has been removed)
```

Environment variables:
- `ANTHROPIC_API_KEY` — Claude API key
- `FRONTEND_URL` — allowed CORS origin (default: `http://localhost:5173`)

Run: `uvicorn backend.main:app --reload` from repo root.

---

## /frontend

React 18 + TypeScript + Vite. react-router-dom for routing. Vitest + React Testing Library for tests.

```
/frontend
  index.html
  package.json
  vite.config.ts
  tsconfig.json
  /src
    main.tsx                      App entry point
    App.tsx                       Router: / → ScenarioSelect, /scenarios/:scenarioId → ScenarioRoute
    ScenarioSelect.tsx            Home page — grid of scenario cards, navigates to /scenarios/{id}
    test-setup.ts                 Vitest + jest-dom setup
    /scenarios
      /shared                     Generic components used by every scenario
        types.ts                  ConversationMessage, VoiceConfig, SessionState interfaces
        ScenarioPage.tsx          Session state manager — calls /init and /chat for any scenarioId
        ConversationInterface.tsx Full conversation UI: history, input, PulseIndicator, AudioPlayer
        PulseIndicator.tsx        Pulsing light — opacity = (limit - counter) / limit
        AudioPlayer.tsx           ElevenLabs TTS caller, auto-plays audio
      /copy                       (empty — copy-specific components have been removed)
```

Environment variables:
- `VITE_API_URL` — backend base URL (default: `http://localhost:8000`)
- `VITE_ELEVENLABS_API_KEY` — ElevenLabs API key

Run: `npm run dev` from `/frontend`.

---

## Adding a new scenario

1. Create `/scenarios/{id}/config.json` and `/scenarios/{id}/system_prompt.txt`
2. The backend picks it up automatically via `lru_cache` on first request
3. The frontend already routes `/scenarios/:scenarioId` to `ScenarioPage`
4. Update `ScenarioSelect.tsx` to mark the scenario `available: true` (or add a card if not already listed)

No other code changes needed.
