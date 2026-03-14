import { useEffect, useMemo, useState } from "react";
import ReactFlow, { Background, Controls } from "reactflow";
import type { Node } from "reactflow";
import "reactflow/dist/style.css";
import { useStoryState, type Scene } from "./hooks/useStoryState";
import { generateAndAttachStoryboard } from "./services/imageGenerator";

type DirectorPingResponse = {
  director_response: string;
  trace: string[];
  node: {
    id: string;
    label: string;
    type: string;
    x: number;
    y: number;
  };
};

export default function App() {
  const [directorText, setDirectorText] = useState("Director offline.");
  const [error, setError] = useState("");
  const [apiKey, setApiKey] = useState("");

  const { scenes, trace, upsertScene, updateScene, addTrace } = useStoryState();

  useEffect(() => {
    fetch("http://localhost:8000/director/ping")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data: DirectorPingResponse) => {
        setDirectorText(data.director_response);
        data.trace.forEach((item) => {
          addTrace({
            type: item,
            message: item,
            timestamp: new Date().toISOString(),
          });
        });

        upsertScene({
          id: data.node.id,
          title: data.node.label,
          description: `A key story beat centered on ${data.node.label}`,
          mood: "mysterious",
          directorNotes: "Wide establishing shot",
        });
        setError("");
      })
      .catch((err: Error) => {
        setDirectorText("Director failed to connect.");
        addTrace({
          type: "backend_unreachable",
          message: "backend_unreachable",
          timestamp: new Date().toISOString(),
        });
        setError(err.message);
      });
  }, [addTrace, upsertScene]);

  useEffect(() => {
    const nextScene = scenes.find(
      (scene) => !scene.imageUrl && !scene.imageLoading && !scene.imageError,
    );

    if (!apiKey.trim() || !nextScene) {
      return;
    }

    void generateAndAttachStoryboard(
      apiKey.trim(),
      nextScene.id,
      nextScene,
      updateScene,
      addTrace,
    );
  }, [apiKey, addTrace, scenes, updateScene]);

  const nodes = useMemo<Node[]>(
    () =>
      scenes.map((scene, index) => ({
        id: scene.id,
        position: { x: 120 + index * 260, y: 160 },
        data: {
          label: scene.title,
        },
        type: "default",
      })),
    [scenes],
  );

  const activeScene: Scene | undefined = scenes[0];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 360px",
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
          <h2 style={{ marginTop: 0, marginBottom: "12px" }}>Director</h2>
          <p style={{ lineHeight: 1.5 }}>{directorText}</p>
          {error ? (
            <p style={{ color: "#FF6B6B", fontSize: "14px" }}>Error: {error}</p>
          ) : null}
          <label style={{ display: "block", marginTop: "12px", fontSize: "14px" }}>
            Gemini API Key
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="AIza..."
              style={{
                display: "block",
                width: "100%",
                marginTop: "8px",
                padding: "8px",
                background: "#0D0D0D",
                color: "#E8E8E8",
                border: "1px solid #2f2f48",
                borderRadius: "6px",
              }}
            />
          </label>
        </section>

        <section style={{ marginBottom: "24px" }}>
          <h3 style={{ marginTop: 0, marginBottom: "12px" }}>Storyboard Preview</h3>
          {activeScene?.imageLoading ? <p>Generating storyboard...</p> : null}
          {activeScene?.imageUrl ? (
            <img
              src={activeScene.imageUrl}
              alt={activeScene.title}
              style={{ width: "100%", borderRadius: "8px", border: "1px solid #2f2f48" }}
            />
          ) : null}
          {activeScene?.imageError ? (
            <p style={{ color: "#FF6B6B" }}>Failed to generate storyboard image.</p>
          ) : null}
        </section>

        <section>
          <h3 style={{ marginTop: 0, marginBottom: "12px" }}>Trace View</h3>
          <ul style={{ paddingLeft: "20px", margin: 0 }}>
            {trace.map((item, index) => (
              <li key={`${item.type}-${index}`} style={{ marginBottom: "8px" }}>
                {item.type}
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
