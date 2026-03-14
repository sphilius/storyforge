# AGENTS.md — Director Mode (StoryForge)

## Project
**Director Mode**: Voice-directed AI cinematographer for the **Gemini Live Agent Challenge**.
Creative Storyteller track. **Deadline: March 16, 2026 5:00 PM PDT.**

## Architecture Decision: Client-Side Live API
The frontend connects **DIRECTLY** to the Gemini Live API via WebSocket from the browser.
No backend proxy for audio. The backend is for REST endpoints only (health, fallback text generation).
User enters their Gemini API key in a settings modal (stored in localStorage).

This is the same proven pattern used by Director-OS (see reference: github.com/sphilius/director-os).

## Setup
```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend (optional, for REST fallback)
cd backend && pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

## Verified Model Strings (March 12, 2026)

### USE THESE
| Purpose | Model String |
|---------|-------------|
| Live API (bidirectional audio) | `gemini-2.5-flash-native-audio-preview-12-2025` |
| Image generation (primary) | `imagen-4.0-generate-001` |
| Image generation (fast/NITRO) | `gemini-3.1-flash-image-preview` (Nano Banana 2) |
| Text fallback | `gemini-2.5-flash` |
| Pro reasoning | `gemini-3.1-pro-preview` |

### DEAD MODELS — DO NOT USE UNDER ANY CIRCUMSTANCES
| Model String | Status |
|-------------|--------|
| `gemini-2.5-flash-image-preview` | **SHUT DOWN January 15, 2026** |
| `gemini-3-pro-preview` | **SHUT DOWN March 9, 2026** |
| `gemini-live-2.5-flash-preview-native-audio-09-2025` | **Deprecated March 19, 2026** |
| `gemini-2.0-flash` | **Deprecated, shutting down soon** |
| `imagen-3.0-generate-001` | Works but superseded by Imagen 4 |

## Tech Stack
- **Frontend**: React 19, TypeScript, Vite 7, React Flow v11 (`reactflow`), zustand, lucide-react, Tailwind-style inline
- **Backend**: Python FastAPI (minimal REST only)
- **Voice**: Gemini Live API via direct WebSocket from browser
- **Images**: Imagen 4 or Nano Banana 2 via Gemini REST API from browser
- **Deploy**: Vercel (frontend auto-deploy) + Cloud Run (full stack for submission)

## Code Style
- TypeScript strict mode, functional components, React hooks
- State management: zustand stores
- No CSS modules — use inline styles or Tailwind utility patterns
- Dark theme everywhere:
  - Background: `#0D0D0D`
  - Panels: `#1A1A2E`
  - Accent (amber): `#D4A017`
  - Text: `#E8E8E8`
  - Error: `#FF6B6B`
  - Success: `#4CAF50`
  - Muted: `#888888`

## File Structure Target
```
storyforge/
├── frontend/
│   ├── public/
│   │   └── audio-processor.js          # AudioWorklet for mic capture
│   ├── src/
│   │   ├── App.tsx                      # Main layout: canvas + trace + voice
│   │   ├── hooks/
│   │   │   ├── useLiveSession.ts        # Gemini Live API WebSocket
│   │   │   ├── useAudioPipeline.ts      # Mic capture + playback + barge-in
│   │   │   └── useStoryState.ts         # Story state (zustand)
│   │   ├── components/
│   │   │   ├── SpatialCanvas.tsx        # React Flow infinite canvas
│   │   │   ├── TraceView.tsx            # Right panel: system activity log
│   │   │   ├── VoiceButton.tsx          # Floating mic button
│   │   │   ├── ApiKeyModal.tsx          # First-visit API key entry
│   │   │   ├── SentinelWarnings.tsx     # Toast warnings
│   │   │   ├── StatusBar.tsx            # Top bar: branding + connection + stats
│   │   │   └── nodes/
│   │   │       ├── SceneNode.tsx        # Custom React Flow node for scenes
│   │   │       └── CharacterNode.tsx    # Custom React Flow node for characters
│   │   ├── services/
│   │   │   ├── imageGenerator.ts        # Storyboard image generation
│   │   │   ├── storySentinel.ts         # Narrative quality analysis
│   │   │   └── lorePool.ts             # Lore extraction + three-clue rule
│   │   └── styles/
│   │       └── global.css
│   ├── vercel.json
│   ├── package.json
│   └── vite.config.ts
├── backend/
│   └── app/
│       └── main.py                      # FastAPI: /health + /director/ping
├── docs/                                # PRD, Architecture, Demo Script, etc.
├── infra/
│   └── deploy.sh                        # Cloud Run deployment
├── AGENTS.md                            # This file
├── Dockerfile
└── README.md
```

## Testing
```bash
cd frontend && npm run build    # MUST succeed for Vercel deploy
cd frontend && npm run dev      # Local dev server at localhost:5173
```

## Important Context for Agents
- This is a hackathon project. Prioritize working code over perfect code.
- All demo content must be generated live, not pre-recorded.
- The spatial canvas (React Flow) IS the primary UI. No chatbox.
- Base branch for all work: `claude/consolidate-hybrid-repo-0xHMu`
- The Live API WebSocket URL format:
  `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`
