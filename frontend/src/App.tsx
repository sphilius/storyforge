import { useEffect, useMemo, useState } from "react";
import ReactFlow, { Background, Controls } from "reactflow";
import type { Node } from "reactflow";
import "reactflow/dist/style.css";
import { ApiKeyModal } from "./components/ApiKeyModal";
import { useLiveSession } from "./hooks/useLiveSession";
import { useStoryState } from "./hooks/useStoryState";

const API_KEY_STORAGE_KEY = "storyforge:gemini-api-key";

export default function App() {
  const { connect, disconnect, status } = useLiveSession();
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
      </aside>

      <ApiKeyModal
        open={showApiKeyModal}
        status={status}
        onConnect={connect}
        onDismiss={() => setShowApiKeyModal(false)}
      />
    </div>
  );
}
