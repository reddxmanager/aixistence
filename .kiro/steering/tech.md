# Tech Stack

## Frontend

- **React 18** + **TypeScript** — `frontend/src/`
- **Vite 5** — dev server and build tool
- **react-router-dom v6** — client-side routing (`/scenarios/:scenarioId`)
- **ElevenLabs TTS API** — called directly from the browser (no backend proxy)
- **Vitest** + **React Testing Library** + **fast-check** — unit and property-based tests
- Deployed to **Netlify**

Key env vars:
- `VITE_API_URL` — backend base URL (default: `http://localhost:8000`)
- `VITE_ELEVENLABS_API_KEY` — ElevenLabs API key

## Backend

- **Python** + **FastAPI** — `backend/`
- **Anthropic Python SDK** — Claude API (`claude-3-5-sonnet-20241022`)
- **Pydantic v2** — request/response models
- Stateless per-request — no database, no session storage
- Deployed to **Render**

Key env vars:
- `ANTHROPIC_API_KEY` — Claude API key
- `FRONTEND_URL` — allowed CORS origin (default: `http://localhost:5173`)

Run: `uvicorn backend.main:app --reload` from repo root.

## API

Two endpoints, parameterised by scenario ID:

```
POST /scenarios/{scenario_id}/init   → opening_line, voice_config, exchange_limit
POST /scenarios/{scenario_id}/chat   → response_text, exchange_counter, shutdown
```

The backend loads `scenarios/{id}/config.json` and `system_prompt.txt` on first request and caches them. Any scenario directory is automatically supported — no router changes needed.

## No database

Conversations are session-only (React state). Nothing is written to disk or a database. This is intentional — the AIs don't persist either.
