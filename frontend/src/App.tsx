import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, { Background, Controls, MiniMap } from "reactflow";
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

export default function App() {
  const { connect, disconnect, status, sendAudio, sendText, onAudio, onTurnComplete, onInterrupt } = useLiveSession();
  const audio = useAudioPipeline();
  const [recording, setRecording] = useState(false);
  const [textInput, setTextInput] = useState("");
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
      // Barge-in: interrupt AI playback when user starts talking
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

  const handleTextSend = useCallback(() => {
    if (textInput.trim()) {
      // Interrupt AI playback when director sends a text command
      if (audio.isPlaying()) {
        audio.interrupt();
      }
      addTrace({
        id: `trace-text-${Date.now()}`,
        type: "user_input",
        message: `📝 "${textInput.trim()}"`,
        timestamp: Date.now(),
      });
      sendText(textInput.trim());
      setTextInput("");
    }
  }, [textInput, sendText, addTrace, audio]);

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
      {/* Status Bar */}
      <StatusBar
        status={status}
        sceneCount={scenes.length}
        characterCount={characters.length}
      />

      {/* Trace View */}
      <TraceView events={traceEvents} />

      {/* Canvas */}
      <div style={{ position: "absolute", top: 36, left: 0, right: 320, bottom: 64 }}>
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
        </ReactFlow>
      </div>

      {/* Bottom control bar */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 320,
          height: 64,
          background: "#0D0D0Dee",
          borderTop: "1px solid #1A1A2E",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          zIndex: 100,
          backdropFilter: "blur(8px)",
        }}
      >
        {/* Text input */}
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleTextSend(); }}
          placeholder={status === "connected" ? "Type a direction..." : "Connect to begin"}
          disabled={status !== "connected"}
          style={{
            width: 360,
            borderRadius: 10,
            border: "1px solid #343455",
            background: "#1A1A2E",
            color: "#E8E8E8",
            padding: "10px 14px",
            fontSize: 13,
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={handleTextSend}
          disabled={status !== "connected" || !textInput.trim()}
          style={{
            border: "none",
            background: "#D4A017",
            color: "#0D0D0D",
            borderRadius: 10,
            padding: "10px 16px",
            fontWeight: 700,
            fontSize: 13,
            cursor: status === "connected" && textInput.trim() ? "pointer" : "not-allowed",
            opacity: status === "connected" && textInput.trim() ? 1 : 0.5,
          }}
        >
          Send
        </button>

        {/* Voice button */}
        <button
          type="button"
          onClick={toggleRecording}
          disabled={status !== "connected"}
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            border: recording ? "2px solid #FF4444" : "2px solid #333",
            background: recording ? "rgba(255,0,0,0.15)" : "#1A1A2E",
            color: recording ? "#FF4444" : status === "connected" ? "#D4A017" : "#555",
            fontSize: 20,
            cursor: status === "connected" ? "pointer" : "not-allowed",
            boxShadow: recording ? "0 0 20px rgba(255,0,0,0.3)" : "none",
            transition: "all 0.2s ease",
          }}
        >
          {recording ? "⏹" : "🎤"}
        </button>

        {/* Settings */}
        <button
          type="button"
          onClick={() => setShowApiKeyModal(true)}
          style={{
            border: "1px solid #343455",
            background: "#1A1A2E",
            color: "#888",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          ⚙️
        </button>
      </div>

      {/* CSS keyframe for spinner */}
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
