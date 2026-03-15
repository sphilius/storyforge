import { useCallback, useEffect, useRef, useState } from "react";
import "reactflow/dist/style.css";
import { useStoryState } from "./hooks/useStoryState";
import { useLiveSession } from "./hooks/useLiveSession";
import { useAudioPipeline } from "./hooks/useAudioPipeline";
import { runStorySentinel } from "./services/storySentinel";
import { extractLorePool, runThreeClueRule } from "./services/lorePool";
import { generateAndAttachStoryboard } from "./services/imageGenerator";
import type { StorySentinelWarning } from "./services/storySentinel";
import { SpatialCanvas } from "./components/SpatialCanvas";
import { TraceView } from "./components/TraceView";
import { VoiceButton } from "./components/VoiceButton";
import { StatusBar } from "./components/StatusBar";
import { SentinelWarnings } from "./components/SentinelWarnings";
import { ApiKeyModal } from "./components/ApiKeyModal";

export default function App() {
  const [showApiModal, setShowApiModal] = useState(true);
  const [traceOpen, setTraceOpen] = useState(true);
  const [recording, setRecording] = useState(false);
  const [sentinelWarnings, setSentinelWarnings] = useState<StorySentinelWarning[]>([]);
  const lastSentinelInputRef = useRef("");
  const apiKeyRef = useRef("");

  const {
    scenes,
    characters,
    traceEvents,
    updateScene,
    addTrace,
  } = useStoryState();

  const liveSession = useLiveSession();
  const audio = useAudioPipeline();

  // Voice button state
  const voiceState = recording ? "recording" : audio.isPlaying() ? "playing" : "idle";

  // Connect to Live API
  const handleConnect = useCallback(
    (apiKey: string) => {
      apiKeyRef.current = apiKey;
      liveSession.connect(apiKey);
    },
    [liveSession],
  );

  // Wire live session events
  const wiredRef = useRef(false);
  useEffect(() => {
    if (wiredRef.current) return;
    wiredRef.current = true;

    // Audio from model -> playback
    liveSession.onAudio((b64) => {
      audio.schedulePlayback(b64, audio.turnSequence());
    });

    // Tool calls -> update state + storyboards
    liveSession.onToolCall((name, args, _result) => {
      const a = args as Record<string, string>;
      addTrace({
        id: `trace-${Date.now()}`,
        type: "tool_call",
        message: `Tool: ${name}`,
        timestamp: Date.now(),
      });

      if (name === "generate_storyboard" && a.prompt) {
        // Find the scene that matches and generate storyboard
        const scene = scenes.find((s) => s.title === a.scene_title);
        if (scene && apiKeyRef.current) {
          void generateAndAttachStoryboard(
            apiKeyRef.current,
            scene.id,
            scene,
            updateScene,
            addTrace,
          );
        }
      }
    });

    // Turn complete -> run sentinel
    liveSession.onTurnComplete(() => {
      addTrace({
        id: `trace-${Date.now()}`,
        type: "model_responding",
        message: "Turn complete",
        timestamp: Date.now(),
      });

      // Run story sentinel on last input
      if (lastSentinelInputRef.current) {
        const warnings = runStorySentinel(lastSentinelInputRef.current, "");
        const lorePool = extractLorePool(lastSentinelInputRef.current);
        const clueWarnings = runThreeClueRule(lorePool);
        const allWarnings = [...warnings, ...clueWarnings];
        if (allWarnings.length > 0) {
          setSentinelWarnings(allWarnings);
          for (const w of allWarnings) {
            addTrace({
              id: `trace-${Date.now()}-${w.code}`,
              type: "sentinel_warning",
              message: w.message,
              timestamp: Date.now(),
            });
          }
        }
      }
    });
  }, [liveSession, audio, addTrace, scenes, updateScene, setSentinelWarnings]);

  // Barge-in: interrupt playback when user speaks
  useEffect(() => {
    audio.setBargeInCallback(() => {
      audio.interrupt();
    });
  }, [audio]);

  // Auto-generate storyboards for scenes without images
  useEffect(() => {
    const key = apiKeyRef.current;
    if (!key) return;
    const pending = scenes.find(
      (s) => !s.imageUrl && !s.imageLoading && !s.imageError,
    );
    if (pending) {
      void generateAndAttachStoryboard(key, pending.id, pending, updateScene, addTrace);
    }
  }, [scenes, updateScene, addTrace]);

  // Toggle recording
  const handleVoiceToggle = useCallback(async () => {
    if (recording) {
      audio.stopCapture();
      setRecording(false);
    } else {
      if (liveSession.status !== "connected") return;
      await audio.startCapture((b64) => {
        liveSession.sendAudio(b64);
      });
      setRecording(true);
      addTrace({
        id: `trace-${Date.now()}`,
        type: "user_input",
        message: "Mic recording started",
        timestamp: Date.now(),
      });
    }
  }, [recording, audio, liveSession, addTrace]);

  // Auto-dismiss modal when connected
  useEffect(() => {
    if (liveSession.status === "connected") {
      setShowApiModal(false);
    }
  }, [liveSession.status]);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0D0D0D", color: "#E8E8E8" }}>
      <StatusBar
        connectionStatus={liveSession.status}
        sceneCount={scenes.length}
        characterCount={characters.length}
      />

      <div style={{ display: "flex", flex: 1, marginTop: 40, overflow: "hidden" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <SpatialCanvas scenes={scenes} characters={characters} />
        </div>
        <TraceView events={traceEvents} open={traceOpen} onToggle={() => setTraceOpen((v) => !v)} />
      </div>

      <VoiceButton state={voiceState} onClick={() => void handleVoiceToggle()} />

      <SentinelWarnings warnings={sentinelWarnings} />

      <ApiKeyModal
        open={showApiModal}
        status={liveSession.status}
        onConnect={handleConnect}
        onDismiss={() => setShowApiModal(false)}
      />

      {/* Pulse animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,68,68,0.5); }
          50% { box-shadow: 0 0 0 16px rgba(255,68,68,0); }
        }
        @keyframes pulse-amber {
          0%, 100% { box-shadow: 0 0 0 0 rgba(212,160,23,0.5); }
          50% { box-shadow: 0 0 0 16px rgba(212,160,23,0); }
        }
      `}</style>
    </div>
  );
}
