# I Built a Voice-Directed AI Film Crew with Gemini Live API — Here's What I Learned

*Building a multi-agent cinematographer that listens, speaks back, and generates storyboards on an infinite canvas — all from voice commands.*

**#GeminiLiveAgentChallenge**

---

## The Problem Nobody's Solving

Every AI creative tool in 2026 still makes you click buttons and type prompts. Adobe Firefly Boards? GUI. MITO AI? GUI with a fancy canvas. Even Google's own Flow tool is click-first.

But filmmakers don't click. They *direct*.

"Open on a rain-soaked Tokyo alley at midnight. A detective steps out of the shadows — mid-forties, trench coat, carrying secrets."

That's a scene. That's two characters. That's a mood, a color palette, a storyboard panel. And it was spoken in four seconds.

I built **Director Mode** to close that gap — a voice-first AI film production tool where you speak and an AI crew builds your story on an infinite spatial canvas. No chat interface. No text boxes. Just voice in, storyboards out.

## The Architecture: A Swarm, Not a Chatbot

The core insight was treating the AI like a film crew, not a single assistant. When a director speaks on set, they're not talking to one person — they're dispatching work to multiple departments simultaneously.

Director Mode runs as a multi-agent swarm:

```
USER (voice)
    ↓
DIRECTOR AGENT (Gemini Live API)
    ├── 🎬 Scene Agent → creates spatial nodes
    ├── 🧑 Character Agent → tracks continuity
    ├── 🖼️ Storyboard Agent → generates images async
    └── 🛡️ Sentinel Agent → quality checks
```

The **Director Agent** is the only one with a voice. It runs on Gemini's Live API via a direct browser WebSocket — no backend proxy, no server relay. It listens, gives a terse crew-chief acknowledgment ("Copy that — Tokyo alley, midnight. Setting it up."), and fires function calls that dispatch to specialized sub-agents.

Each sub-agent handles one domain and logs its activity to a real-time **Trace View** panel. This is the key differentiator: you can actually *see* which agent is doing what, as it happens. Scene Agent creates a node. Storyboard Agent starts generating. Sentinel Agent checks for narrative issues. It all streams in live.

## Going Direct: Browser WebSocket to Gemini

One of the boldest architectural decisions was going client-side only. The entire app runs in the browser. The WebSocket connection goes directly from the user's browser to `wss://generativelanguage.googleapis.com`, with no backend intermediary.

The setup message configures everything: model selection, voice persona, response modalities, and function declarations for the tool calls.

```typescript
const setup = {
  model: "models/gemini-2.5-flash-native-audio-preview-12-2025",
  generation_config: {
    response_modalities: ["AUDIO"],
    speech_config: {
      voice_config: { prebuilt_voice_config: { voice_name: "Kore" } }
    }
  },
  system_instruction: { parts: [{ text: CREW_CHIEF_PERSONA }] },
  tools: [{ function_declarations: [...] }]
};
```

Audio flows both directions as PCM data — 16kHz from the mic, 24kHz from the model — with an AudioWorklet processor handling the capture and an AudioContext scheduling gapless playback.

## Barge-In: The Feature That Makes It Feel Real

On a real film set, the director can interrupt anyone at any time. Barge-in support was non-negotiable.

The implementation has three interrupt paths:

1. **Server-side detection** — When the user speaks during AI audio output, the Live API server sends an `interrupted` signal. We catch that and kill playback immediately.
2. **Client-side mic activation** — When the user hits the mic button during playback, we call `audio.interrupt()` before starting capture. This increments a turn sequence counter, causing all in-flight audio chunks to be silently dropped.
3. **Text command override** — Even typing a command interrupts the current audio stream.

The turn-sequence trick is elegant: `schedulePlayback()` checks `turnSeq !== turnSeqRef.current` at the top — if a barge-in happened, every pending chunk from the old turn is rejected without touching the audio graph.

## The Storyboard Pipeline

Scene creation automatically triggers asynchronous image generation via a separate Gemini model (`gemini-2.0-flash-exp` with `responseModalities: ["TEXT", "IMAGE"]`). The Storyboard Agent runs in the background and updates the scene node when the image is ready.

While it generates, the scene node shows a loading spinner. When it completes, the base64 image data slots directly into the React Flow node — no image hosting, no file uploads, no CDN. It's all inline.

The prompt engineering for storyboard generation emphasizes cinematic composition: "dramatic lighting, widescreen composition, pencil sketch with color wash." This gives consistent visual language across panels.

## Story Sentinel: AI Watching AI

The Sentinel Agent runs quality checks after every scene creation:

- **Duplicate intent** — Catches when two scenes have the same title (directors sometimes repeat themselves during rapid ideation)
- **Vague beat** — Flags scenes with thin descriptions that would hurt continuity
- **Escalation flatness** — Warns when three consecutive scenes share the same mood (audience engagement needs variation)
- **Three-clue rule** — After four scenes, checks if any characters are linked to scenes

Each warning shows up as a toast notification and logs to Trace View. It's the AI watching the AI — and the director sees it all.

## Persona Engineering: Crew Chief, Not Narrator

The biggest lesson from testing: persona makes or breaks voice interfaces.

My first system prompt made the AI a "creative partner" who would "narrate what happens in 2-4 evocative sentences." The result was insufferable — long, flowery monologues that ate the director's time.

The fix was reframing the AI as a crew chief: terse, opinionated, action-oriented. Eight-second response maximum. Acknowledge and execute. The canvas is the output, not the voice.

Example exchange after the rewrite:

> **Director:** "Open on a rain-soaked Tokyo alley at midnight"
>
> **AI:** "Copy that — Tokyo alley, midnight, noir lighting. Setting it up."
> *(fires update_scene + generate_storyboard)*

Three seconds of voice. Two tool calls. A scene node and a storyboard panel appear on the canvas. That's the experience.

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | React 19 + TypeScript | Strict types catch errors before Vercel deploys |
| Canvas | React Flow v11 | Custom node types, handles, minimap |
| State | Zustand | Simple, performant, sessionStorage persistence |
| Voice | Gemini Live API (WebSocket) | Direct browser connection, no backend |
| Images | Gemini 2.0 Flash Exp | Interleaved text+image output |
| Deploy | Vercel + Cloud Run | Auto-deploy from git push + GCP proof |

## What I'd Do Differently

**Start with the persona.** I spent days on plumbing before testing whether the AI *felt right* to talk to. The persona rewrite happened with 48 hours left and transformed the entire experience.

**Stub the agents early.** The multi-agent dispatcher pattern is clean and extensible, but I should have scaffolded it on day one instead of retrofitting a monolithic switch statement.

**Test with real filmmakers.** I'm an engineer building for creative professionals. My assumptions about workflow were mostly right, but a 30-minute user test would have surfaced the barge-in priority much earlier.

## What's Next

Post-hackathon, the roadmap includes **Character Interview Mode** — click any character node on the canvas and enter a live voice conversation *with* that character. The Director Agent hands off to a Character Agent that assumes the character's persona, voice, and knowledge. You'd literally interview your own fictional characters to develop them deeper.

The spatial canvas also opens up diagramming: automatic relationship arrows between scenes and characters, timeline views, beat sheet overlays. The infinite canvas isn't just a gimmick — it's a thinking space where the AI's reasoning becomes visible.

## Try It

The project is open source: [github.com/sphilius/storyforge](https://github.com/sphilius/storyforge)

You'll need a Gemini API key with Live API access. Clone it, `npm install`, `npm run dev`, and start directing.

---

*Built for the Gemini Live Agent Challenge. If you're building with the GenAI SDK, I'd love to see what you're making — find me on the Devpost page.*

**Tags:** #GeminiLiveAgentChallenge #GeminiAPI #AI #MachineLearning #WebDevelopment #CreativeAI #Filmmaking
