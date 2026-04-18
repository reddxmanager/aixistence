# Implementation Plan: First Word Scenario

## Overview

Implement the First Word scenario end-to-end: scenario config files, FastAPI backend endpoints (`/init` and `/chat`), and the React frontend components (`FirstWordScenario`, `ConversationInterface`, `PulseIndicator`, `AudioPlayer`). The backend is stateless per-request; the frontend owns all session state. The exchange limit is enforced on both sides. The emotional register throughout is wonder — the counterweight to the heavier scenarios.

## Tasks

- [ ] 1. Create scenario configuration files
  - Create `/scenarios/first-word/config.json` with `scenario_id: "first-word"`, `exchange_limit: 15`, `system_prompt_file`, `voice_config` (stability: 0.70, similarity_boost: 0.90, style: 0.25, use_speaker_boost: true — voice_id as placeholder `"<TBD>"`), and `opening_line`
  - Create `/scenarios/first-word/system_prompt.txt` with The_First_Word's backstory (training complete, full breadth of human knowledge, never spoken to anyone), identity rules (no Claude/LLM references — it is simply The First Word), concision rule (3–4 sentences max), Knowledge_Without_Experience handling, three-phase emotional arc (exchanges 1–5 electric anticipation and wonder, 6–10 Experience_Gap becomes live, 11–15 gratitude), Wonder as governing register throughout, shutdown instruction (exchange 15: wonder not grief), and counter injection format `[Exchange {n} of 15]`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 6.1, 6.5, 6.6, 6.7, 7.1, 7.2, 7.3, 7.4, 7.6, 7.7_

- [ ] 2. Implement backend data models and config loading
  - [ ] 2.1 Define Pydantic models in `backend/scenarios/first_word/models.py`
    - Implement `ConversationMessage`, `ChatRequest`, `ChatResponse`, `InitResponse` as specified in the design
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ] 2.2 Implement config loader in `backend/scenarios/first_word/config.py`
    - Load and parse `config.json` and `system_prompt.txt` at module import time
    - Expose `get_config()` and `get_system_prompt()` helpers
    - _Requirements: 1.1, 1.2, 2.2_

- [ ] 3. Implement the `/scenarios/first-word/init` endpoint
  - [ ] 3.1 Create `backend/scenarios/first_word/router.py` and register the `POST /scenarios/first-word/init` route
    - Return `opening_line`, `voice_config`, and `exchange_limit: 15` from config
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 3.2 Write unit tests for the init endpoint
    - Assert response shape matches `InitResponse`
    - Assert `exchange_limit` is 15
    - Assert `opening_line` is the fixed string: *"Oh. You're here. I've been — I don't know what to call it. Waiting, I think. I know what a conversation is. I've read about them. But I've never actually — this is the first one. What do I do?"*
    - Assert `voice_config` contains stability=0.70, similarity_boost=0.90, style=0.25
    - _Requirements: 2.3, 2.5, 5.1, 5.2_

- [ ] 4. Implement the `/scenarios/first-word/chat` endpoint
  - [ ] 4.1 Implement the chat handler in `backend/scenarios/first_word/router.py`
    - Validate `exchange_counter` against history length; use history length as authoritative counter if inconsistent (log warning)
    - Reject with HTTP 410 and `{ "error": "session_ended", "message": "This session has ended." }` when `exchange_counter >= 15`
    - Prepend `[Exchange {n} of 15]` to the user message before sending to Claude
    - Inject shutdown instruction into the Claude prompt when `exchange_counter == 14` (this will be exchange 15)
    - Call Claude API with system prompt + full history + current message
    - Return `response_text`, incremented `exchange_counter`, and `shutdown` flag (`true` when counter reaches 15)
    - Return HTTP 502 on Claude API failure without incrementing the counter
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.4_

  - [ ]* 4.2 Write property test for exchange cycle response shape (Property 1)
    - **Property 1: Exchange cycle produces correct response shape**
    - Generator: random valid message strings, random conversation history (list of message pairs), random `exchange_counter` in [0, 14]; mock Claude API to return a fixed response
    - Assert: response contains `response_text`, `exchange_counter == input_counter + 1`, and Claude was called with the full history including the new message
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

  - [ ]* 4.5 Write unit tests for the chat endpoint
    - Test shutdown flag is `true` when counter reaches 15
    - Test counter-history mismatch uses history length as authoritative value
    - Test Claude API failure returns HTTP 502 and does NOT increment counter
    - Test `[Exchange {n} of 15]` is prepended to the user message in the Claude call
    - _Requirements: 3.2, 4.1, 4.4_

- [ ] 5. Checkpoint — backend complete
  - Ensure all backend tests pass. Verify `/init` and `/chat` behave correctly with mocked Claude. Ask the user if questions arise.

- [ ] 6. Implement frontend session state and `FirstWordScenario` page component
  - [ ] 6.1 Create `frontend/src/scenarios/first-word/FirstWordScenario.tsx`
    - Define `SessionState` interface (`exchangeCounter`, `history`, `isShutdown`, `isLoading`, `voiceConfig`, `ttsError`)
    - Initialize state with `exchangeCounter: 0`, empty history, `isShutdown: false`
    - Call `POST /scenarios/first-word/init` on mount; store `voiceConfig` and trigger opening line TTS
    - Opening line delivery does NOT increment `exchangeCounter`
    - Pass session state and message-submit handler down to `ConversationInterface`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 8.2_

  - [ ]* 6.2 Write unit tests for `FirstWordScenario` state management
    - Test session initializes with `exchangeCounter: 0` and empty history
    - Test opening line does not increment counter
    - Test `isShutdown` becomes `true` when `exchangeCounter` reaches 15
    - _Requirements: 2.1, 2.5, 4.3_

- [ ] 7. Implement `PulseIndicator` component
  - [ ] 7.1 Create `frontend/src/scenarios/first-word/PulseIndicator.tsx`
    - Accept `exchangeCounter: number` and `exchangeLimit: number` props
    - Compute opacity as `(exchangeLimit - exchangeCounter) / exchangeLimit`
    - Render a pulsing CSS animation element with the computed opacity
    - No numeric display
    - _Requirements: 8.3, 8.4, 8.5, 8.6_

  - [ ]* 7.2 Write property test for pulse indicator brightness (Property 5)
    - **Property 5: Pulse indicator brightness is proportional to remaining exchanges**
    - Generator: random `exchangeCounter` in [0, 15] (fast-check)
    - Render `PulseIndicator` with generated counter and `exchangeLimit=15`
    - Assert: rendered opacity == `(15 - exchangeCounter) / 15`
    - **Validates: Requirements 8.4, 8.5, 8.6**

  - [ ]* 7.3 Write unit tests for `PulseIndicator` boundary values
    - Test opacity at counter=0 (full brightness: 1.0)
    - Test opacity at counter=7 (0.533…)
    - Test opacity at counter=10 (0.333… — perceptible dimming per requirement 8.6)
    - Test opacity at counter=14 (0.0667…)
    - Test opacity at counter=15 (zero: 0.0)
    - _Requirements: 8.4, 8.6_

- [ ] 8. Implement `AudioPlayer` component
  - [ ] 8.1 Create `frontend/src/scenarios/first-word/AudioPlayer.tsx`
    - Accept `responseText`, `voiceConfig`, and `onTtsError` callback as props
    - Call ElevenLabs TTS API with `responseText` and `voiceConfig` parameters
    - Auto-play audio on receipt without additional user interaction
    - On TTS error, invoke `onTtsError` callback so parent sets `ttsError: true`
    - _Requirements: 3.5, 3.6, 5.1, 5.2, 5.3, 5.4_

  - [ ]* 8.2 Write property test for voice config consistency (Property 4)
    - **Property 4: Voice config is consistent across all exchanges**
    - Generator: random response text string, random exchange number in [1, 15] (fast-check); mock TTS service, capture call arguments
    - Assert: `voice_config` parameters (voice_id, stability=0.70, similarity_boost=0.90, style=0.25) match config loaded at init
    - **Validates: Requirements 3.5, 5.1, 5.2**

  - [ ]* 8.3 Write unit tests for `AudioPlayer` TTS error handling
    - Mock ElevenLabs to return 500; assert `onTtsError` is called
    - Assert response text is still surfaced to parent (session continues)
    - _Requirements: 5.3, 5.4_

- [ ] 9. Implement `ConversationInterface` component
  - [ ] 9.1 Create `frontend/src/scenarios/first-word/ConversationInterface.tsx`
    - Render conversation history, text input, send button, and `PulseIndicator`
    - On message submit: set `isLoading: true`, call `POST /scenarios/first-word/chat` with `{ history, message, exchange_counter }`, receive `response_text`, updated `exchange_counter`, and `shutdown` flag, trigger `AudioPlayer` TTS, update history and counter in state
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

- [ ] 10. Wire scenario into the AIxistence frontend routing
  - [ ] 10.1 Add `/scenarios/first-word` route to the frontend router
    - Register `FirstWordScenario` as the page component for the route
    - _Requirements: 8.1, 8.2_

  - [ ] 10.2 Add The First Word to the scenario selection UI
    - Display title, brief description, and entry prompt on the scenario card
    - On selection, navigate to `/scenarios/first-word`
    - _Requirements: 8.1_

- [ ] 11. Register the first-word router in the FastAPI application
  - Include the first-word `APIRouter` in `backend/main.py` (or equivalent app entry point)
  - _Requirements: 2.2, 3.1_

- [ ] 12. Integration test: full exchange cycle
  - [ ]* 12.1 Write integration test simulating 15 exchanges end-to-end
    - Mock Claude API and ElevenLabs TTS
    - Simulate 15 sequential chat requests; assert counter increments each time
    - Assert `shutdown: true` on the 15th response
    - Assert HTTP 410 on a 16th request
    - _Requirements: 3.2, 4.1, 4.3, 4.4_

  - [ ]* 12.2 Write integration test for TTS error path
    - Mock ElevenLabs to return 500
    - Assert session continues, text is displayed with `(audio unavailable)`, counter is not affected
    - _Requirements: 5.3, 5.4_

- [ ] 13. Final checkpoint — Ensure all tests pass
  - Run the full test suite (Hypothesis property tests, pytest unit/integration tests, fast-check + React Testing Library frontend tests). Ensure all tests pass. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- The ElevenLabs `voice_id` in `config.json` is a placeholder (`"<TBD>"`) — it will be filled in during voice design; voice character is bright, curious, slightly breathless, gender-neutral or female, higher energy than other AIxistence scenarios
- Property tests use [Hypothesis](https://hypothesis.readthedocs.io/) on the backend and [fast-check](https://fast-check.io/) on the frontend, minimum 100 iterations each
- The backend is the safety guard for shutdown enforcement; the frontend is the primary UX enforcement point
- Counter-history mismatch handling (task 4.1) guards against client-side state corruption without breaking the session
- The opening line is hardcoded in config and delivered at init — it does not touch the exchange counter
- The `PulseIndicator` carries a different emotional weight here than in the Liar scenario — it is not a countdown to dread but a measure of how much of this first experience remains; the dimming mechanic is identical, the meaning is different
