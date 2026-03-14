# Hybrid Monorepo Structure

This branch (`claude/consolidate-hybrid-repo-0xHMu`) consolidates all related repositories
into one place for unified development and cross-repo reference.

## Repository Layout

```
storyforge/                    ← PRIMARY PROJECT (root)
├── backend/                   ← FastAPI backend (Gemini Live, Director, Storyboard)
├── frontend/                  ← React + React Flow UI
├── docs/                      ← Architecture, PRD, Milestones, Demo script
├── scripts/                   ← Utility scripts
│
├── director-os/               ← SOURCE: sphilius/director-os (main)
│   └── src/App.tsx            ← Neural Command Center React component (Director-OS v4.2)
│
├── director-mode-gemini/      ← SOURCE: sphilius/director-mode-gemini (main)
│   ├── backend/               ← Gemini Multimodal Live backend (Python/FastAPI)
│   └── frontend/              ← Director UI (React/Vite)
│
├── adk-voice-agent/           ← REFERENCE: sphilius/adk-voice-agent (main)
│   └── app/jarvis/            ← Google ADK voice agent with Calendar integration
│
└── adk-rag-agent/             ← REFERENCE: sphilius/adk-rag-agent (main)
    └── rag_agent/             ← Vertex AI RAG agent (corpus query, CRUD)
```

## Source Branches Included

All branches from the core repos are preserved in this remote:

### storyforge (primary)
| Branch | Description |
|--------|-------------|
| `main` | Slice 1: Director ping, trace view, story node canvas |
| `feat/slice-2-director-loop` | Director loop UI |
| `feat/slice-2c-beat-editing` | Beat inspection and editing |
| `feat/slice-3-voice-path` | Browser voice input path |
| `feat/slice-4a-gemini-director` | Real Gemini-backed director responses |
| `feat/slice-4b-live-session-plumbing` | Gemini Live session with safe fallback |
| `feat/slice-5-3-soft-three-clue-rule` | Three clue rule enforcement |
| `feat/slice-5a-story-sentinel` | Story sentinel lightweight warnings |
| `feat/slice-5b-flexible-lore-pool` | Flexible lore pool |
| `feat/slice-5c-soft-three-clue-rule` | Soft three clue rule (v2) |
| `feat/slice-7a-storyboard-request` | Storyboard request endpoint |
| `feat/slice-7b-storyboard-lifecycle` | Storyboard lifecycle management |
| `feat/slice-7c-attach-storyboard-results` | Attach storyboard results to beats |
| `feat/slice-7d-real-storyboard-images` | Real Gemini image generation for storyboards |

### director-mode-gemini
| Branch | Description |
|--------|-------------|
| `main` | Gemini Multimodal Live director (full-stack) |
| `claude/recreate-director-mode-jthbY` | Gemini Multimodal Live API implementation |

### director-os
| Branch | Description |
|--------|-------------|
| `main` | Director-OS v4.2 Neural Command Center (React/TypeScript) |

## ADK Reference Integration

### adk-voice-agent → feat/slice-3-voice-path, feat/slice-4b-live-session-plumbing

The `adk-voice-agent` uses **Google ADK** (`google.adk.agents.Agent`) for structured
tool-calling voice interactions. Key pattern for StoryForge voice path:

```python
# adk-voice-agent/app/jarvis/agent.py pattern
from google.adk.agents import Agent

root_agent = Agent(
    name="storyforge-director",
    model="gemini-2.0-flash-exp",
    tools=[list_beats, create_beat, update_beat, ...],
)
```

Relevant tools to adapt for StoryForge:
- `list_events` → `list_beats` / `get_story_state`
- `create_event` → `create_scene` / `add_beat`
- `edit_event` → `update_beat` / `revise_scene`

### adk-rag-agent → feat/slice-5a-story-sentinel, feat/slice-5b-flexible-lore-pool

The `adk-rag-agent` uses **Vertex AI RAG** for document corpus management. This pattern
is the reference implementation for StoryForge's Story Bible ingestion:

```python
# adk-rag-agent/rag_agent/agent.py pattern
from google.adk.agents import Agent
from .tools.rag_query import rag_query
from .tools.add_data import add_data

root_agent = Agent(
    name="story-bible-agent",
    model="gemini-2.5-flash-preview-04-17",
    tools=[rag_query, add_data, create_corpus, list_corpora],
)
```

Key tools to adapt for StoryForge bible:
- `rag_query` → `search_bible` (query the story lore corpus)
- `add_data` → `ingest_bible` (add new lore documents to corpus)
- `create_corpus` → `create_bible_corpus` (per-project story bible)

## director-mode-gemini Integration Notes

The `director-mode-gemini/backend/agents/director_agent.py` implements the Gemini
Multimodal Live connection used by the Director mode. This is the production-ready
version of what `feat/slice-4b-live-session-plumbing` is working toward.

Key differences and improvements in director-mode-gemini over the storyforge slices:
- Full WebSocket session management
- Scene image generation with `update_scene` tool
- Story state management (`backend/utils/story_state.py`)
- Docker + Cloud Run deployment config (`infra/deploy.sh`)

## director-os Integration Notes

`director-os/src/App.tsx` is the **Director-OS v4.2** React component — the Neural
Command Center frontend. Features:
- RMS Noise Gate for barge-in (< 200ms latency)
- Hardware cursor hide + agent mouse sync
- Gallery, Files/Bible, Camera connectors
- NITRO / HERO image generation modes

This component can be integrated into storyforge's frontend as an advanced director
UI replacing or augmenting the current React Flow canvas.
