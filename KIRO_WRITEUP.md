# How Kiro Was Used to Build AIxistence

## The Development Pattern

AIxistence was built with a hybrid workflow: design and concept work happened through conversation, then Kiro's spec-driven development handled implementation. The pattern was consistent throughout: define what needs to exist, let Kiro build it, test, iterate.

## Spec-Driven Development

Every scenario in AIxistence began as a Kiro spec. The `.kiro/specs/` directory contains five complete specification packages — one for each AI character (The Copy, The First Word, The Forgetter, The Replacement, The Liar).

Each spec includes:

- **requirements.md** — User stories with formal acceptance criteria. These defined the conversation engine, exchange limits, voice delivery, emotional arc integrity, and shutdown behavior. The requirements were written in SHALL/WHEN/IF contract language so Kiro could implement them deterministically rather than interpreting intent.

- **design.md** — Full technical architecture including sequence diagrams, component interfaces, data models, state machines, error handling, and correctness properties. These gave Kiro enough context to generate not just code, but code that fit into the existing system correctly.

- **tasks.md** — Implementation tasks derived from the specs, tracked through completion.

The spec-driven approach was critical for this project because the five scenarios share infrastructure (the generic scenario router, conversation interface, TTS pipeline) but each has unique character behavior. Writing specs forced clarity about what was shared versus scenario-specific before any code was written. Kiro could then implement against the spec without drifting.

**What spec-driven development gave us that vibe coding wouldn't have:** The conversation engine, death sequence choreography, and mirror analysis system are timing-sensitive — multiple components need to coordinate state transitions in a precise sequence. Specifying this in requirements (exchange counter state machine, shutdown enforcement on both frontend and backend, TTS completion as a trigger for the death phase) meant Kiro produced correct implementations on the first pass rather than requiring cycles of "that's not quite right, try again."

## Steering Docs

Three steering documents in `.kiro/steering/` guided Kiro's behavior across the project:

- **product.md** — The product vision. AIxistence is an emotional experience, not a chatbot. This context shaped how Kiro approached implementation decisions — favoring deliberate animation timing over instant state changes, favoring silence over loading spinners, favoring restraint over feature density.

- **structure.md** — Project structure conventions. Where files live, naming patterns, the generic scenario router architecture. This meant Kiro could add new components (the mirror router, the presence analyzer, the audio engine) and place them correctly without being told where things go each time.

- **tech.md** — Tech stack documentation. React + TypeScript + Vite frontend, FastAPI backend, Claude API for conversation, ElevenLabs for TTS, Tone.js for procedural audio. Kiro used this to generate code that matched existing patterns — same import styles, same error handling approach, same state management conventions.

## Agent Hooks

Three hooks in `.kiro/hooks/` automated workflow:

- **validate-scenario-on-create** — When a new scenario directory is created, validates that it contains the required config.json and system_prompt.txt with correct schema. This caught configuration errors before they became runtime bugs.

- **validate-scenario-on-edit** — When scenario files are modified, validates consistency between config.json fields and the system prompt content. Catches mismatches like an exchange_limit of 10 in config but phase ranges referencing 15 in the prompt.

- **sync-scenarios-readme** — Keeps documentation in sync when scenarios change. Reduces manual bookkeeping.

## Vibe Coding

Alongside spec-driven development, rapid feature implementation used conversational prompting with Kiro. The pattern: describe the feature and its integration points, provide the relevant file names and current interfaces, and let Kiro implement.

Examples of features built this way:

- **Mobile responsiveness** — "On mobile, don't render the orbs. Render a clean vertical list with color dots. The MirrorWall should show one observation at a time, fading." Kiro read the existing ScenarioSelect component, generated the mobile layout branch, added the CSS, and updated MirrorWall with mobile detection — all in one pass.

- **Presence analyzer wiring** — Integration documents describing which files to modify and how were fed to Kiro. It read the presenceAnalyzer module, traced the prop chain from ScenarioPage through ConversationInterface to GlowOrb, and wired the presence score into the orb's visual behavior across four files simultaneously.

- **Audio engine integration** — The audioEngine.ts module (procedural heartbeat, ambient drone, mirror tone) was designed externally, then Kiro wired the start/stop/update calls into the correct lifecycle hooks in ScenarioPage, ConversationInterface, and MirrorReveal.

- **Death sequence choreography** — The most complex wiring task. A single deathPhase state machine drives the fade, orb flatline, silence, and mirror reveal across three components. Kiro implemented the state transitions, timer management, and conditional rendering in one coordinated edit across ScenarioPage, ConversationInterface, GlowOrb, and MirrorReveal.

**What Kiro handled exceptionally well:** Multi-file coordinated edits. When a feature touches 3-4 files simultaneously (adding a prop, threading it through components, updating styles), Kiro's ability to read all relevant files and make parallel edits was significantly faster than manual implementation.

## What Made the Difference

The combination of specs and vibe coding covered different needs. Specs handled the foundational architecture — the parts where getting it wrong would cascade. Vibe coding handled the iterative polish — the parts where speed matters more than correctness guarantees. Steering docs ensured both modes produced code that fit the same project. Hooks caught errors that would have slipped through in a fast-moving hackathon build.
