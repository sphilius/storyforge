import { useEffect, useState } from "react";
import ReactFlow, { Background, Controls } from "reactflow";
import type { Node } from "reactflow";
import "reactflow/dist/style.css";

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
  const [trace, setTrace] = useState<string[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [error, setError] = useState("");

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
        setTrace(data.trace);
        setNodes([
          {
            id: data.node.id,
            position: { x: data.node.x, y: data.node.y },
            data: { label: data.node.label },
            type: "default",
          },
        ]);
        setError("");
      })
      .catch((err: Error) => {
        setDirectorText("Director failed to connect.");
        setTrace(["backend_unreachable"]);
        setError(err.message);
      });
  }, []);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 320px",
        height: "100vh",
        background: "#0f1115",
        color: "#f5f7fa",
      }}
    >
      <main style={{ background: "#111318" }}>
        <ReactFlow nodes={nodes} edges={[]} fitView>
          <Background />
          <Controls />
        </ReactFlow>
      </main>

      <aside
        style={{
          background: "#171a21",
          borderLeft: "1px solid #2b2f3a",
          padding: "16px",
          overflowY: "auto",
        }}
      >
        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ marginTop: 0, marginBottom: "12px" }}>Director</h2>
          <p style={{ lineHeight: 1.5 }}>{directorText}</p>
          {error ? (
            <p style={{ color: "#ff8a80", fontSize: "14px" }}>
              Error: {error}
            </p>
          ) : null}
        </section>

        <section>
          <h3 style={{ marginTop: 0, marginBottom: "12px" }}>Trace View</h3>
          <ul style={{ paddingLeft: "20px", margin: 0 }}>
            {trace.map((item) => (
              <li key={item} style={{ marginBottom: "8px" }}>
                {item}
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}