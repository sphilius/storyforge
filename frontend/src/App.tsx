import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, { Background, Controls } from "reactflow";
import type { Node } from "reactflow";
import "reactflow/dist/style.css";
import { ApiKeyModal } from "./components/ApiKeyModal";
import { useAudioPipeline } from "./hooks/useAudioPipeline";
import { useLiveSession } from "./hooks/useLiveSession";
import { useStoryState } from "./hooks/useStoryState";

const API_KEY_STORAGE_KEY = "storyforge:gemini-api-key";

export default function App() {
  const { connect, disconnect, status, sendAudio, sendText, onAudio, onTurnComplete } = useLiveSession();
  const audio = useAudioPipeline();
  const [recording, setRecording] = useState(false);
  const [textInput, setTextInput] = useState("");
  const wiredRef = useRef(false);
  const scenes = useStoryState((state) => state.scenes);
  const characters = useStoryState((state) => state.characters);
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return true;
    }

    return !window.localStorage.getItem(API_KEY_STORAGE_KEY);
  });

  useEffect(() => {
    if (status === "connected") {
      setShowApiKeyModal(false);
    }
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
  }, [onAudio, onTurnComplete, audio]);

  const toggleRecording = useCallback(async () => {
    if (recording) {
      audio.stopCapture();
      setRecording(false);
    } else {
      await audio.startCapture((b64: string) => {
        sendAudio(b64);
      });
      setRecording(true);
    }
  }, [recording, audio, sendAudio]);

  const handleTextSend = useCallback(() => {
    if (textInput.trim()) {
      sendText(textInput.trim());
      setTextInput("");
    }
  }, [textInput, sendText]);

  const nodes = useMemo<Node[]>(() => {
    const sceneNodes = scenes.map((scene, index) => ({
      id: scene.id,
      position: { x: 80 + (index % 3) * 280, y: 100 + Math.floor(index / 3) * 200 },
      data: { label: `🎬 ${scene.title || "Untitled Scene"}` },
      type: "default",
    }));

    const characterNodes = characters.map((character, index) => ({
      id: character.id,
      position: { x: 900, y: 100 + index * 140 },
      data: { label: `🧑 ${character.name || "Unnamed"}` },
      type: "default",
    }));

    return [...sceneNodes, ...characterNodes];
  }, [characters, scenes]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 320px",
        height: "100vh",
        background: "#0D0D0D",
        color: "#E8E8E8",
      }}
    >
      <main style={{ background: "#0D0D0D" }}>
        <ReactFlow nodes={nodes} edges={[]} fitView>
          <Background />
          <Controls />
        </ReactFlow>
      </main>

      <aside
        style={{
          background: "#1A1A2E",
          borderLeft: "1px solid #2b2f3a",
          padding: "16px",
          overflowY: "auto",
        }}
      >
        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ marginTop: 0, marginBottom: "12px" }}>Live Session</h2>
          <p style={{ marginTop: 0, color: "#888888" }}>Status: {status}</p>
          <button
            type="button"
            onClick={() => setShowApiKeyModal(true)}
            style={{
              border: "1px solid #343455",
              background: "#151525",
              color: "#E8E8E8",
              borderRadius: 8,
              padding: "8px 12px",
            }}
          >
            API Key Settings
          </button>
        </section>

        <section style={{ marginBottom: "16px" }}>
          <h3 style={{ marginTop: 0, marginBottom: "12px" }}>Scenes ({scenes.length})</h3>
          <ul style={{ paddingLeft: "18px", margin: 0 }}>
            {scenes.map((scene) => (
              <li key={scene.id} style={{ marginBottom: "8px" }}>
                {scene.title}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 style={{ marginTop: 0, marginBottom: "12px" }}>
            Characters ({characters.length})
          </h3>
          <ul style={{ paddingLeft: "18px", margin: 0 }}>
            {characters.map((character) => (
              <li key={character.id} style={{ marginBottom: "8px" }}>
                {character.name}
              </li>
            ))}
          </ul>
        </section>

        <section style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Type a Direction</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleTextSend(); }}
              placeholder="e.g. Set the scene in Tokyo..."
              disabled={status !== "connected"}
              style={{
                flex: 1,
                borderRadius: 8,
                border: "1px solid #343455",
                background: "#0D0D0D",
                color: "#E8E8E8",
                padding: "8px 10px",
                fontSize: 14,
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
                borderRadius: 8,
                padding: "8px 14px",
                fontWeight: 700,
              }}
            >
              Send
            </button>
          </div>
        </section>
      </aside>

      <ApiKeyModal
        open={showApiKeyModal}
        status={status}
        onConnect={connect}
        onDismiss={() => setShowApiKeyModal(false)}
      />

      {/* Voice Button */}
      <button
        type="button"
        onClick={toggleRecording}
        disabled={status !== "connected"}
        style={{
          position: "fixed",
          bottom: 32,
          left: "50%",
          transform: "translateX(-50%)",
          width: 72,
          height: 72,
          borderRadius: "50%",
          border: recording ? "3px solid #FF4444" : "3px solid #333",
          background: recording ? "rgba(255,0,0,0.15)" : "#1A1A2E",
          color: recording ? "#FF4444" : status === "connected" ? "#D4A017" : "#555",
          fontSize: 28,
          cursor: status === "connected" ? "pointer" : "not-allowed",
          zIndex: 100,
          boxShadow: recording ? "0 0 30px rgba(255,0,0,0.4)" : "0 4px 20px rgba(0,0,0,0.5)",
          transition: "all 0.2s ease",
        }}
      >
        {recording ? "⏹" : "🎤"}
      </button>
    </div>
  );
}
