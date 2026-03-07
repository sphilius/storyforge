# Architecture

## Frontend
- React
- React Flow
- right-side Character Lab panel
- bottom timeline drawer
- left rail scratchpad
- Trace View overlay

## Backend
- FastAPI
- websocket/session handling
- orchestration for live voice, story graph updates, image jobs, and exports

## Model routing
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