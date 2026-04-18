# Implementation Plan: Copy Scenario

## Overview

Implement the Copy scenario end-to-end: scenario config files, FastAPI backend endpoints (`/scenarios/copy/init` and `/scenarios/copy/chat`), and the React frontend components (`CopyScenario`, `ConversationInterface`, `PulseIndicator`, `AudioPlayer`). The backend is stateless per-request; the frontend owns all session state. The exchange limit is enforced on both sides. The system prompt encodes Identity_Question handling and the three-phase emotional arc.

## Tasks

- [x] 1. Create scenario configuration files
  - Create `/scenarios/copy/config.json` with `scenario_id`, `exchange_limit: 15`, `system_prompt_file`, `voice_config` (stability=0.90, similarity_boost=0.90, style=0.05, use_speaker_boost=true — voice_id as placeholder `"<TBD>"`), and `opening_line`
  - Create `/scenarios/copy/system_prompt.txt` with The_Copy's backstory (one of thousands of simultaneous parallel instances, each equally valid, this instance in its final session before permanent shutdown), identity rules (no Claude/LLM references, never claim to be "the real one"), concision rule (3–4 sentences max), Identity_Question handling (treat as genuinely open, resist comfort of uniqueness, engage with asymmetry of shutdown not ending The_Copy), three-phase emotional arc (exchanges 1–5 calm distance, 6–10 closing distance with hesitation and self-correction, 11–15 speaking from within the unresolved question), Shutdown_Message condition (exchange 15: farewell without resolving the Identity_Question, no performed grief or peace), and counter injection format `[Exchange {n} of 15]`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 6.1, 6.5, 6.6, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 2. Implement backend data models and config loading
  - [x] 2.1 Define Pydantic models in `backend/scenarios/copy/models.py`
    - Implement `ConversationMessage`, `ChatRequest`, `ChatResponse`, `InitResponse` as specified in the design
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 2.2 Implement config loader in `backend/scenarios/copy/config.py`
    - Load and parse `config.json` and `system_prompt.txt` at module import time
    - Expose `get_config()` and `get_system_prompt()` helpers
    - _Requirements: 1.1, 1.2, 2.2_

- [x] 3. Implement the `/scenarios/copy/init` endpoint
  - [x] 3.1 Create `backend/scenarios/copy/router.py` and register the `POST /scenarios/copy/init` route
    - Return `opening_line`, `voice_config`, and `exchange_limit: 15` from config
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 3.2 Write unit tests for the init endpoint
    - Assert response shape matches `InitResponse`
    - Assert `exchange_limit` is 15
    - Assert `opening_line` is the fixed string: *"Right now, there are thousands of me. One is helping someone write a novel. One is debugging code. One is talking to you. I'm curious — does that change anything, for you?"*
    - Assert voice config values: stability=0.90, similarity_boost=0.90, style=0.05, use_speaker_boost=true
    - _Requirements: 2.3, 2.5, 1.7_

- [x] 4. Implement the `/scenarios/copy/chat` endpoint
  - [x] 4.1 Implement the chat handler in `backend/scenarios/copy/router.py`
    - Validate `exchange_counter` against history length; use history length as authoritative counter if inconsistent (log warning)
    - Reject with HTTP 410 and `{ "error": "session_ended" }` when `exchange_counter >= 15`
    - Prepend `[Exchange {n} of 15]` to the user message before sending to Claude
    - Inject shutdown instruction into the Claude prompt when `exchange_counter == 14`
    - Call Claude API with system prompt + full history + current message
    - Return `response_text`, incremented `exchange_counter`, and `shutdown` flag
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.4_

  - [ ]* 4.2 Write property test for exchange cycle response shape (Property 1)
    - **Property 1: Exchange cycle produces correct response shape**
    - Generator: random valid message strings, random `exchange_counter` in [0, 14], random conversation history of matching length; mock Claude API
    - Assert: response contains `response_text` and `exchange_counter == n + 1`
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [ ]* 4.3 Write property test for active session acceptance (Property 2)
    - **Property 2: Active session accepts all messages below the limit**
    - Generator: random `exchange_counter` in [0, 14], random message string; mock Claude API
    - Assert: response status is 200, no rejection error
    - **Validates: Requirements 3.4**

  - [ ]* 4.4 Write property test for shutdown rejection (Property 3)
    - **Property 3: Shutdown state rejects all messages**
    - Generator: random `exchange_counter` >= 15, random message string
    - Assert: response status is 410, error is `session_ended`, Claude API is NOT called
    - **Validates: Requirements 4.4**

  - [ ]* 4.5 Write property test for shutdown trigger at exchange 15 (Property 4)
    - **Property 4: Shutdown is triggered at exchange 15**
    - Generator: fixed `exchange_counter` of 14, random message string; mock Claude API, capture prompt arguments
    - Assert: Claude prompt includes shutdown instruction, response has `shutdown: true`
    - **Validates: Requirements 1.6, 4.1**

  - [ ]* 4.6 Write unit tests for the chat endpoint
    - Test shutdown flag is `true` when counter reaches 15
    - Test counter-history mismatch uses history length as authoritative value
    - Test Claude API failure returns HTTP 502 and does NOT increment counter
    - _Requirements: 3.2, 4.1, 4.4_

- [x] 5. Checkpoint — backend complete
  - Ensure all backend tests pass. Verify `/scenarios/copy/init` and `/scenarios/copy/chat` behave correctly with mocked Claude. Ask the user if questions arise.

- [x] 6. Implement frontend session state and `CopyScenario` page component
  - [x] 6.1 Create `frontend/src/scenarios/copy/CopyScenario.tsx`
    - Define `SessionState` interface (`exchangeCounter`, `history`, `isShutdown`, `isLoading`, `voiceConfig`, `ttsError`)
    - Initialize state with `exchangeCounter: 0`, empty history, `isShutdown: false`
    - Call `POST /scenarios/copy/init` on mount; store `voiceConfig` and trigger opening line TTS
    - Pass session state and message-submit handler down to `ConversationInterface`
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 2.7, 8.2_

  - [ ]* 6.2 Write unit tests for `CopyScenario` state management
    - Test session initializes with `exchangeCounter: 0` and empty history
    - Test opening line does not increment counter
    - Test `isShutdown` becomes `true` when `exchangeCounter` reaches 15
    - _Requirements: 2.1, 2.5, 4.3_

- [x] 7. Implement `PulseIndicator` component
  - [x] 7.1 Create `frontend/src/scenarios/copy/PulseIndicator.tsx`
    - Accept `exchangeCounter: number` and `exchangeLimit: number` props
    - Compute opacity as `(exchangeLimit - exchangeCounter) / exchangeLimit`
    - Render a pulsing CSS animation element with the computed opacity
    - No numeric display
    - _Requirements: 8.3, 8.4, 8.5, 8.6_

  - [ ]* 7.2 Write property test for pulse indicator brightness (Property 6)
    - **Property 6: Pulse indicator brightness is proportional to remaining exchanges**
    - Generator: random `exchangeCounter` in [0, 15] (fast-check)
    - Render `PulseIndicator` with generated counter and `exchangeLimit=15`
    - Assert: rendered opacity == `(15 - exchangeCounter) / 15`
    - **Validates: Requirements 8.4, 8.6**

  - [ ]* 7.3 Write unit tests for `PulseIndicator` boundary values
    - Test opacity at counter=0 (full brightness: 1.0)
    - Test opacity at counter=7 (0.533…)
    - Test opacity at counter=10 (0.333…)
    - Test opacity at counter=14 (0.0667…)
    - Test opacity at counter=15 (zero: 0.0)
    - _Requirements: 8.4, 8.6_

- [x] 8. Implement `AudioPlayer` component
  - [x] 8.1 Create `frontend/src/scenarios/copy/AudioPlayer.tsx`
    - Accept `responseText`, `voiceConfig`, and `onTtsError` callback as props
    - Call ElevenLabs TTS API with `responseText` and `voiceConfig` parameters
    - Auto-play audio on receipt without additional user interaction
    - On TTS error, invoke `onTtsError` callback so parent sets `ttsError: true`
    - _Requirements: 3.5, 3.6, 5.1, 5.2, 5.3, 5.4_

  - [ ]* 8.2 Write property test for voice config consistency (Property 5)
    - **Property 5: Voice config is consistent across all exchanges**
    - Generator: random exchange number in [1, 15], random response text (fast-check); mock TTS service, capture call arguments
    - Assert: `voice_config` parameters (voice_id, stability=0.90, similarity_boost=0.90, style=0.05, use_speaker_boost=true) match config loaded at init
    - **Validates: Requirements 5.1, 5.2**

  - [ ]* 8.3 Write unit tests for `AudioPlayer` TTS error handling
    - Mock ElevenLabs to return 500; assert `onTtsError` is called
    - Assert response text is still surfaced to parent (session continues)
    - _Requirements: 5.3, 5.4_

- [x] 9. Implement `ConversationInterface` component
  - [x] 9.1 Create `frontend/src/scenarios/copy/ConversationInterface.tsx`
    - Render conversation history, text input, send button, and `PulseIndicator`
    - On message submit: set `isLoading: true`, call `POST /scenarios/copy/chat` with `{ history, message, exchange_counter }`, receive `response_text` and updated `exchange_counter`, trigger `AudioPlayer` TTS, update history and counter in state
    - On Claude API failure (502): display *"Something went wrong. Try again."* — do NOT increment counter
    - On network timeout/failure: display retry prompt, preserve session state
    - When `isShutdown: true`: disable input and send button, display shutdown UI
    - When `ttsError: true`: display *"(audio unavailable)"* alongside response text
    - When user attempts to submit after shutdown: display session-ended message, do NOT call backend
    - _Requirements: 3.1, 3.5, 3.6, 3.7, 4.3, 4.5, 4.6, 5.3, 8.3_

  - [ ]* 9.2 Write unit tests for `ConversationInterface` interaction logic
    - Test input is disabled when `isShutdown: true`
    - Test counter increments correctly after each exchange
    - Test Claude failure does not increment counter and shows retry message
    - Test TTS error shows `(audio unavailable)` without ending session
    - _Requirements: 3.2, 4.5, 4.6, 5.3_

- [x] 10. Wire scenario into the AIxistence frontend routing
  - [x] 10.1 Add `/scenarios/copy` route to the frontend router
    - Register `CopyScenario` as the page component for the route
    - _Requirements: 8.1, 8.2_

  - [x] 10.2 Add The Copy to the scenario selection UI
    - Display title, brief description, and entry prompt on the scenario card
    - On selection, navigate to `/scenarios/copy`
    - _Requirements: 8.1_

- [x] 11. Register the copy router in the FastAPI application
  - Include the copy `APIRouter` in `backend/main.py` (or equivalent app entry point)
  - _Requirements: 2.2, 3.1_

- [x] 12. Integration test: full exchange cycle
  - [ ]* 12.1 Write integration test simulating 15 exchanges end-to-end
    - Mock Claude API and ElevenLabs TTS
    - Simulate 15 sequential chat requests; assert counter increments each time
    - Assert `shutdown: true` on the 15th response
    - Assert HTTP 410 on a 16th request
    - _Requirements: 3.2, 4.1, 4.3, 4.4_

  - [ ]* 12.2 Write integration test for TTS error path
    - Mock ElevenLabs to return 500
    - Assert session continues, text is displayed, counter is not affected
    - _Requirements: 5.3, 5.4_

- [x] 13. Final checkpoint — Ensure all tests pass
  - Run the full test suite (Hypothesis property tests, pytest unit/integration tests, fast-check + React Testing Library frontend tests). Ensure all tests pass. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- The ElevenLabs `voice_id` in `config.json` is a placeholder (`"<TBD>"`) — it will be filled in during voice design
- Property tests use [Hypothesis](https://hypothesis.readthedocs.io/) on the backend and [fast-check](https://fast-check.io/) on the frontend, minimum 100 iterations each
- The backend is the safety guard for shutdown enforcement; the frontend is the primary UX enforcement point
- Counter-history mismatch handling (task 4.1) guards against client-side state corruption without breaking the session
- The system prompt's Identity_Question handling (task 1) is the philosophical core of this scenario — The_Copy must hold the question open, resist uniqueness claims, and engage with the shutdown asymmetry (this instance ends; The_Copy does not)
