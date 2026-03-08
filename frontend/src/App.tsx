import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import ReactFlow, { Background, Controls, applyNodeChanges } from "reactflow";
import type { Node, NodeChange, ReactFlowInstance } from "reactflow";
import "reactflow/dist/style.css";

type DirectorResponse = {
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

type StoryNodeData = {
  label: string;
};

export default function App() {
  const [directorText, setDirectorText] = useState("Director offline.");
  const [trace, setTrace] = useState<string[]>([]);
  const [nodes, setNodes] = useState<Node<StoryNodeData>[]>([]);
  const [error, setError] = useState("");
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const flowRef = useRef<ReactFlowInstance | null>(null);
  const hasInitialFitRef = useRef(false);

  const toNode = (data: DirectorResponse): Node<StoryNodeData> => ({
    id: data.node.id,
    position: { x: data.node.x, y: data.node.y },
    data: { label: data.node.label },
    type: "default",
  });

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
  }, []);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.selected),
    [nodes],
  );

  const handleFlowInit = useCallback((instance: ReactFlowInstance) => {
    flowRef.current = instance;
  }, []);

  useEffect(() => {
    setIsLoading(true);
    fetch("http://localhost:8000/director/ping")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data: DirectorResponse) => {
        setDirectorText(data.director_response);
        setTrace(data.trace);
        setNodes([toNode(data)]);
        setError("");
      })
      .catch((err: Error) => {
        setDirectorText("Director failed to connect.");
        setTrace(["backend_unreachable"]);
        setError(err.message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!flowRef.current || hasInitialFitRef.current || nodes.length === 0) {
      return;
    }
    flowRef.current.fitView({ padding: 0.2, duration: 250 });
    hasInitialFitRef.current = true;
  }, [nodes.length]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userInput.trim()) {
      return;
    }

    setIsLoading(true);
    fetch("http://localhost:8000/director/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_input: userInput }),
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data: DirectorResponse) => {
        setDirectorText(data.director_response);
        setTrace(data.trace);
        setNodes((prev) => [
          ...prev,
          { ...toNode(data), id: `${data.node.id}-${Date.now()}` },
        ]);
        setError("");
        setUserInput("");
      })
      .catch((err: Error) => {
        setError(err.message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

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
        <ReactFlow
          nodes={nodes}
          edges={[]}
          onNodesChange={onNodesChange}
          onInit={handleFlowInit}
        >
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
          <h2 style={{ marginTop: 0, marginBottom: "8px" }}>Dev Input (Temporary)</h2>
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", gap: "8px", alignItems: "center" }}
          >
            <input
              value={userInput}
              onChange={(event) => setUserInput(event.target.value)}
              placeholder="Enter story impulse"
              style={{
                flex: 1,
                height: "32px",
                borderRadius: "6px",
                border: "1px solid #2b2f3a",
                background: "#0f1115",
                color: "#f5f7fa",
                padding: "0 10px",
              }}
            />
            <button
              type="submit"
              disabled={isLoading}
              style={{
                height: "32px",
                borderRadius: "6px",
                border: "1px solid #3c4252",
                background: "#222837",
                color: "#f5f7fa",
                padding: "0 10px",
                cursor: isLoading ? "not-allowed" : "pointer",
              }}
            >
              {isLoading ? "Sending..." : "Send"}
            </button>
          </form>
        </section>

        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ marginTop: 0, marginBottom: "12px" }}>Director</h2>
          {isLoading ? (
            <p style={{ color: "#9aa0ad", fontSize: "14px", marginTop: 0 }}>
              Loading...
            </p>
          ) : null}
          <p style={{ lineHeight: 1.5 }}>{directorText}</p>
          {error ? (
            <p style={{ color: "#ff8a80", fontSize: "14px" }}>
              Error: {error}
            </p>
          ) : null}
        </section>

        <section style={{ marginBottom: "24px" }}>
          <h3 style={{ marginTop: 0, marginBottom: "12px" }}>Selected Node</h3>
          {selectedNode ? (
            <div
              style={{
                border: "1px solid #2b2f3a",
                borderRadius: "8px",
                padding: "10px",
                background: "#111318",
              }}
            >
              <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#9aa0ad" }}>
                ID: {selectedNode.id}
              </p>
              <p style={{ margin: 0, lineHeight: 1.4 }}>{selectedNode.data.label}</p>
            </div>
          ) : (
            <p style={{ margin: 0, color: "#9aa0ad", fontSize: "14px" }}>
              No node selected.
            </p>
          )}
        </section>

        <section>
          <h3 style={{ marginTop: 0, marginBottom: "12px" }}>Trace View</h3>
          <ul style={{ paddingLeft: "20px", margin: 0 }}>
            {trace.map((item, index) => (
              <li key={`${item}-${index}`} style={{ marginBottom: "8px" }}>
                {item}
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
