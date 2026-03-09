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
- `.env` configuration via `GEMINI_API_KEY` and `GEMINI_TEXT_MODEL`
- model-call trace events for started/completed/failed with safe fallback on errors

## Model routing
- Gemini text model: Director beat response generation (`/director/respond`)
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
