# 🎬 Director Mode

**Voice-directed AI cinematographer powered by Gemini Live API**

Director Mode replaces the chatbox with an infinite spatial canvas. Filmmakers speak scene descriptions aloud, and a multi-agent AI crew generates storyboard panels, maintains character continuity, and visualizes the story in real-time.

> Built for the **Gemini Live Agent Challenge** — Creative Storyteller track

## ✨ Key Features

- **Voice Direction** — Speak naturally; the AI crew chief acknowledges and executes
- **Multi-Agent Swarm** — 4 specialized agents working in parallel (see architecture below)
- **Spatial Canvas** — React Flow infinite canvas with custom scene/character nodes
- **Storyboard Generation** — AI-generated cinematic panels via Gemini image API
- **Narrative Sentinel** — Real-time story quality checks (duplicates, pacing, escalation)
- **Trace View** — Live visibility into which agent is doing what (the differentiator)
- **Barge-in Support** — Interrupt the AI mid-response, just like on a real set

## 🏗️ Multi-Agent Swarm Architecture

```
USER (voice / text)
    ↓
┌─────────────────────────────────────────────────────┐
│  DIRECTOR AGENT (Gemini Live API — voice interface) │
│  Model: gemini-2.5-flash-native-audio-preview       │
│  • Listens to user via WebSocket                    │
│  • Short verbal acknowledgments (< 8 sec)           │
│  • Dispatches function calls to sub-agents          │
└─────────┬───────────┬───────────┬───────────┬───────┘
          │           │           │           │
    ┌─────▼─────┐ ┌──▼──────┐ ┌─▼────────┐ ┌▼──────────┐
    │ 🎬 SCENE  │ │ 🧑 CHAR │ │ 🖼️ BOARD │ │ 🛡️ SENTINEL│
    │  AGENT    │ │  AGENT  │ │  AGENT   │ │   AGENT   │
    ├───────────┤ ├─────────┤ ├──────────┤ ├───────────┤
    │ Creates   │ │ Creates │ │ Generates│ │ Runs      │
    │ scene     │ │ char    │ │ images   │ │ quality   │
    │ nodes     │ │ nodes   │ │ via REST │ │ checks    │
    │ Triggers  │ │ Tracks  │ │ Attaches │ │ Flags     │
    │ Storyboard│ │ contin- │ │ to scene │ │ warnings  │
    │ Agent     │ │ uity    │ │ nodes    │ │ via toast │
    └───────────┘ └─────────┘ └──────────┘ └───────────┘
          │                         │             │
          └─────────┬───────────────┘             │
                    ▼                             ▼
            ┌──────────────┐            ┌──────────────┐
            │ React Flow   │            │  Trace View  │
            │ Spatial      │            │  (real-time  │
            │ Canvas       │            │   agent log) │
            └──────────────┘            └──────────────┘
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 7, React Flow v11 |
| State | Zustand (persisted to sessionStorage) |
| Voice | Gemini Live API via WebSocket (direct browser connection) |
| Images | Gemini 2.0 Flash Exp (REST API with interleaved output) |
| Deploy | Vercel (frontend), Google Cloud Run (cloud proof) |

## 🚀 Quick Start

```bash
cd frontend
npm install
npm run dev
```

1. Open http://localhost:5173
2. Enter your Gemini API key
3. Click 🎤 and start directing

## ☁️ Deploy to Cloud Run

```bash
chmod +x deploy.sh
./deploy.sh YOUR_PROJECT_ID us-central1
```

## 📁 Project Structure

```
frontend/src/
├── agents/                    # Multi-agent swarm
│   ├── agentDispatcher.ts     # Central dispatch router
│   ├── sceneAgent.ts          # Scene creation + storyboard trigger
│   ├── characterAgent.ts      # Character creation
│   ├── storyboardAgent.ts     # Async image generation
│   └── sentinelAgent.ts       # Narrative quality checks
├── components/
│   ├── StatusBar.tsx           # Top bar with branding + status
│   ├── TraceView.tsx           # Real-time agent activity panel
│   ├── ApiKeyModal.tsx         # API key entry
│   └── nodes/
│       ├── SceneNode.tsx       # Custom scene card with image slot
│       └── CharacterNode.tsx   # Custom character card
├── hooks/
│   ├── useLiveSession.ts      # Gemini WebSocket + tool handling
│   ├── useAudioPipeline.ts    # Audio capture + playback
│   └── useStoryState.ts       # Zustand store
└── App.tsx                     # Main layout
```

## 🏆 Hackathon Submission

- **Track**: Creative Storyteller (interleaved output)
- **Model**: gemini-2.5-flash-native-audio-preview-12-2025
- **Innovation**: Voice-first direction (no chat interface), multi-agent swarm with visible trace
- **#GeminiLiveAgentChallenge**

## 📝 License

MIT
