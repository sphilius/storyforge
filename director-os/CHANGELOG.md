# Director-OS Version History

### [v4.2] - The Stress Test Edition (Current)
- **Feature**: Added floating Session Telemetry HUD with precision uptime tracking.
- **Feature**: Implemented Procedural Audio Milestone Cues (5m, 8m, 10m).
- **Fix**: **Firestore Permission Denied**: Implemented `isAuthReady` guard to prevent listeners from firing before Firebase Auth completion.
- **Fix**: **Barge-in Sensitivity**: Re-calibrated RMS Noise Gate from `0.015` to `0.03` to prevent self-interruption.
- **Fix**: **API Persistence**: Implemented `localStorage` sync for Neural Keys and Profile IDs.
- **Fix**: **Scroll Failure**: Refined `scroll_ui` tool logic with explicit directionality and window object binding.

### [v4.1] - Multimodal Oracle
- **Feature**: Added Multimodal Intelligence Ingestion (YouTube links and text fragments).
- **Feature**: Multi-tenant architecture (CRUD User Profiles + Projects).
- **Feature**: Added `search_bible` tool for RAG-based grounding.

### [v3.0] - Character Forge
- **Feature**: Initial Character Forge tab.
- **Feature**: RMS-based Noise Gate implementation for instant interruption.
- **Feature**: Integrated ElevenLabs API key field for future voice transformations.

### [v2.5] - Zero-Inertia Interaction
- **Feature**: **Hardware Mouse Stealth**: Implemented `cursor-none` with 1:1 agent cursor sync.
- **Feature**: Tiered Synthesis: Added "Nitro" mode using Gemini Flash Image.

### [v2.0] - Handshake Reliability
- **Fix**: **InvalidStateError**: Added `readyState` guards to all WebSocket `.send()` calls.
- **Fix**: **Audio Suspension**: Forced `audioCtx.resume()` during handshake to bypass browser autoplay mutes.

### [v1.0] - Initial Prototype
- Initial deployment of Gemini Live WebSocket integration and Imagen 4 logic.
