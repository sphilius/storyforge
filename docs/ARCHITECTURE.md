# Architecture

## Frontend
- React
- React Flow
- right-side Character Lab panel
- right-side Selected Beat editor (id, title, summary, notes, save/cancel)
- bottom timeline drawer
- left rail scratchpad
- Trace View overlay
- local beat draft state and trace events (`node_selected`, `beat_edit_started`, `beat_updated`)

## Backend
- FastAPI
- websocket/session handling
- orchestration for live voice, story graph updates, image jobs, and exports
- no beat edit persistence endpoints in Slice 2c (frontend-only editing)
- Gemini text generation for Director responses in `/director/respond` (Google Gen AI SDK)
- optional Gemini Live one-turn session path for `/director/respond` when `USE_LIVE_DIRECTOR=true`
- `.env` configuration via `GEMINI_API_KEY`, `GEMINI_TEXT_MODEL`, `GEMINI_LIVE_MODEL`, and `USE_LIVE_DIRECTOR`
- model-call trace events for started/completed/failed with safe fallback on errors
- live-session trace events for started/input/output/closed/failed with safe fallback to non-live path

## Model routing
- Gemini text model: Director beat response generation (`/director/respond`)
- Gemini Live model: Director one-turn live session path (`/director/respond` when enabled)
- Vertex Live API: live director voice loop
- Gemini API image model: async storyboard generation
- later: optional grounding worker

## Background workers
- storyboard worker
- expression-sheet worker
- continuity worker
- export worker
- mood worker

## Visible runtime entities
- Director
- one active interview character

## Invisible runtime workers
- all background workers
