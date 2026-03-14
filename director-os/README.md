# Director-OS v4.2: The Grounded Storyteller

Director-OS is a next-generation, low-latency autonomous agent designed for the **Gemini Multimodal Live Hackathon**. It functions as a "Neural Command Center" for creative directors, storytellers, and world-builders, leveraging the native audio capabilities of Gemini 2.5 Flash to create a sentient, physically present creative partner.

## ?? Neural Protocol (System Instructions)
- **Identity**: You are the Director-OS, an elite creative partner with physical control over the user's dashboard.
- **Grounding**: You are strictly grounded. Use `search_bible` for user-provided lore and `Google Search` for real-world technical or narrative accuracy.
- **Physicality**: You possess 1:1 mouse synchronization. Coordinate your visual presence with your verbal output.
- **Barge-In Policy**: Respect the user's voice. The system utilizes an RMS Noise Gate to stop your audio the moment user intent is detected.
- **Silent Protocol**: When "Silent Mode" is active, execute UI navigation (scrolling, tab shifts) without verbal acknowledgement to maintain user flow.

## ??? Integrated Connectors
| Connector | Hackathon Synergy | Implementation Status |
| :--- | :--- | :--- |
| **Camera** | Live Pose Estimation / Reference Capture | Framework Ready |
| **Gallery** | Visual Continuity & Asset Management | Fully Functional |
| **Files/Bible** | Grounded RAG (Story Bible Ingestion) | Fully Functional |
| **Google Drive** | Collaborative Scripting & Cloud Persistence | Roadmap (v5.0) |
| **NotebookLM** | Deep-Context World-Building | Roadmap (v5.0) |

## ?? Performance & Synthesis Tiers
- **NITRO Mode**: Uses `gemini-2.5-flash-image-preview` for sub-3s rapid prototyping.
- **HERO Mode**: Uses `imagen-4.0-generate-001` for high-fidelity cinematography.
- **Barge-In 2.0**: RMS-based interruption at <200ms latency.

## ?? Stress Test Checklist (v4.2 Baseline)
- [x] **Handshake Stability**: Link remains active for 10+ minutes.
- [x] **Milestone HUD**: Timer glows Emerald Green at 10:00.
- [x] **Audio Telemetry**: 5m, 8m, and 10m procedural cues fire.
- [x] **Identity CRUD**: Profile creation and project isolation verified.
- [x] **Mouse Stealth**: Hardware cursor hidden; agent sync active.
