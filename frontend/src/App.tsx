import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, { Background, Controls, MiniMap, useReactFlow, ReactFlowProvider } from "reactflow";
import type { Node } from "reactflow";
import "reactflow/dist/style.css";
import { ApiKeyModal } from "./components/ApiKeyModal";
import { StatusBar } from "./components/StatusBar";
import { TraceView } from "./components/TraceView";
import { SceneNode } from "./components/nodes/SceneNode";
import { CharacterNode } from "./components/nodes/CharacterNode";
import { useAudioPipeline } from "./hooks/useAudioPipeline";
import { useLiveSession } from "./hooks/useLiveSession";
import { useStoryState } from "./hooks/useStoryState";

const API_KEY_STORAGE_KEY = "storyforge:gemini-api-key";

const NODE_TYPES = {
  sceneNode: SceneNode,
  characterNode: CharacterNode,
};

/** Watches zustand for navigation commands and executes them via React Flow API */
function CanvasNavigator() {
  const { fitView, zoomIn, zoomOut, setCenter, getNodes } = useReactFlow();
  const pendingNavigation = useStoryState((s) => s.pendingNavigation);
  const setNavigation = useStoryState((s) => s.setNavigation);

  useEffect(() => {
    if (!pendingNavigation) return;
    const { action, target } = pendingNavigation;

    switch (action) {
      case "fit_view":
        fitView({ padding: 0.2, duration: 600 });
        break;
      case "zoom_in":
        zoomIn({ duration: 400 });
        break;
      case "zoom_out":
        zoomOut({ duration: 400 });
        break;
      case "pan_left":
        fitView({ padding: 0.2, duration: 400 }); // fallback: re-fit
        break;
      case "pan_right":
        fitView({ padding: 0.2, duration: 400 });
        break;
      case "pan_up":
        fitView({ padding: 0.2, duration: 400 });
        break;
      case "pan_down":
        fitView({ padding: 0.2, duration: 400 });
        break;
      case "focus_node": {
        if (target) {
          const allNodes = getNodes();
          const found = allNodes.find(
            (n) =>
              n.data?.title?.toLowerCase().includes(target.toLowerCase()) ||
              n.data?.name?.toLowerCase().includes(target.toLowerCase()),
          );
          if (found) {
            setCenter(found.position.x + 130, found.position.y + 100, {
              zoom: 1.2,
              duration: 600,
            });
          } else {
            fitView({ padding: 0.2, duration: 600 });
          }
        }
        break;
      }
    }

    // Clear the pending navigation
    setNavigation(null);
  }, [pendingNavigation, setNavigation, fitView, zoomIn, zoomOut, setCenter, getNodes]);

  return null;
}

function AppInner() {
  const { connect, disconnect, status, sendAudio, onAudio, onTurnComplete, onInterrupt } = useLiveSession();
  const audio = useAudioPipeline();
  const [recording, setRecording] = useState(false);
  const wiredRef = useRef(false);
  const scenes = useStoryState((state) => state.scenes);
  const characters = useStoryState((state) => state.characters);
  const traceEvents = useStoryState((state) => state.traceEvents);
  const addTrace = useStoryState((state) => state.addTrace);
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return !window.localStorage.getItem(API_KEY_STORAGE_KEY);
  });

  useEffect(() => {
    if (status === "connected") setShowApiKeyModal(false);
  }, [status]);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  // Wire audio playback (run once)
  useEffect(() => {
    if (wiredRef.current) return;
    wiredRef.current = true;
    onAudio((b64: string) => {
      audio.schedulePlayback(b64, audio.turnSequence());
    });
    onTurnComplete(() => {
      console.log("[App] AI turn complete");
    });
    onInterrupt(() => {
      console.log("[App] Barge-in — interrupting playback");
      audio.interrupt();
      addTrace({
        id: `trace-bargein-${Date.now()}`,
        type: "user_input",
        message: "⚡ Barge-in — AI interrupted",
        timestamp: Date.now(),
      });
    });
  }, [onAudio, onTurnComplete, onInterrupt, audio, addTrace]);

  const toggleRecording = useCallback(async () => {
    if (recording) {
      audio.stopCapture();
      setRecording(false);
      addTrace({
        id: `trace-mic-off-${Date.now()}`,
        type: "user_input",
        message: "🎤 Mic off",
        timestamp: Date.now(),
      });
    } else {
      if (audio.isPlaying()) {
        audio.interrupt();
        addTrace({
          id: `trace-bargein-mic-${Date.now()}`,
          type: "user_input",
          message: "⚡ Barge-in — director took over",
          timestamp: Date.now(),
        });
      }
      await audio.startCapture((b64: string) => {
        sendAudio(b64);
      });
      setRecording(true);
      addTrace({
        id: `trace-mic-on-${Date.now()}`,
        type: "user_input",
        message: "🎤 Mic live — directing...",
        timestamp: Date.now(),
      });
    }
  }, [recording, audio, sendAudio, addTrace]);

  // Build React Flow nodes from story state
  const nodes = useMemo<Node[]>(() => {
    const sceneNodes: Node[] = scenes.map((scene, index) => ({
      id: scene.id,
      position: { x: 80 + (index % 4) * 300, y: 80 + Math.floor(index / 4) * 280 },
      data: {
        title: scene.title,
        description: scene.description,
        mood: scene.mood,
        directorNotes: scene.directorNotes,
        imageUrl: scene.imageUrl,
        imageLoading: scene.imageLoading,
      },
      type: "sceneNode",
    }));

    const characterNodes: Node[] = characters.map((character, index) => ({
      id: character.id,
      position: { x: 80 + scenes.length * 300 + 120, y: 80 + index * 180 },
      data: {
        name: character.name,
        description: character.description,
        motivation: character.motivation,
      },
      type: "characterNode",
    }));

    return [...sceneNodes, ...characterNodes];
  }, [characters, scenes]);

  return (
    <div style={{ height: "100vh", background: "#0D0D0D", color: "#E8E8E8" }}>
      <StatusBar
        status={status}
        sceneCount={scenes.length}
        characterCount={characters.length}
      />

      <TraceView events={traceEvents} />

      {/* Canvas — full width minus trace panel */}
      <div style={{ position: "absolute", top: 36, left: 0, right: 320, bottom: 0 }}>
        <ReactFlow
          nodes={nodes}
          edges={[]}
          nodeTypes={NODE_TYPES}
          fitView
          proOptions={{ hideAttribution: true }}
          style={{ background: "#0D0D0D" }}
        >
          <Background color="#1A1A2E" gap={24} size={1} />
          <Controls
            style={{ background: "#1A1A2E", border: "1px solid #2b2f3a", borderRadius: 8 }}
          />
          <MiniMap
            nodeColor={(node) => {
              if (node.type === "characterNode") return "#9B59B6";
              return "#D4A017";
            }}
            style={{ background: "#0D0D0D", border: "1px solid #1A1A2E" }}
            maskColor="rgba(13, 13, 13, 0.8)"
          />
          <CanvasNavigator />
        </ReactFlow>
      </div>

      {/* Floating voice button — centered at bottom */}
      <button
        type="button"
        onClick={toggleRecording}
        disabled={status !== "connected"}
        style={{
          position: "fixed",
          bottom: 32,
          left: "calc(50% - 160px)",
          transform: "translateX(-50%)",
          width: recording ? 80 : 64,
          height: recording ? 80 : 64,
          borderRadius: "50%",
          border: recording ? "3px solid #FF4444" : "3px solid #333",
          background: recording ? "rgba(255,0,0,0.15)" : "#1A1A2Ecc",
          color: recording ? "#FF4444" : status === "connected" ? "#D4A017" : "#555",
          fontSize: recording ? 28 : 24,
          cursor: status === "connected" ? "pointer" : "not-allowed",
          boxShadow: recording
            ? "0 0 40px rgba(255,0,0,0.4), 0 0 80px rgba(255,0,0,0.15)"
            : "0 4px 24px rgba(0,0,0,0.6)",
          transition: "all 0.25s ease",
          zIndex: 200,
          backdropFilter: "blur(8px)",
        }}
      >
        {recording ? "⏹" : "🎤"}
      </button>

      {/* Recording pulse indicator */}
      {recording && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            left: "calc(50% - 160px)",
            transform: "translateX(-50%)",
            fontSize: 11,
            color: "#FF4444",
            fontWeight: 600,
            letterSpacing: "1px",
            textTransform: "uppercase",
            zIndex: 200,
            textAlign: "center",
            width: 120,
          }}
        >
          ● LIVE
        </div>
      )}

      {/* Settings button — top left */}
      {status !== "connected" && (
        <button
          type="button"
          onClick={() => setShowApiKeyModal(true)}
          style={{
            position: "fixed",
            bottom: 32,
            left: "calc(50% - 160px)",
            transform: "translateX(-50%)",
            border: "2px solid #D4A017",
            background: "#1A1A2E",
            color: "#D4A017",
            borderRadius: 12,
            padding: "12px 24px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            zIndex: 200,
          }}
        >
          Connect Gemini
        </button>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <ApiKeyModal
        open={showApiKeyModal}
        status={status}
        onConnect={connect}
        onDismiss={() => setShowApiKeyModal(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <AppInner />
    </ReactFlowProvider>
  );
}
