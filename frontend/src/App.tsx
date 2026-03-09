import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import ReactFlow, { Background, Controls, applyNodeChanges } from "reactflow";
import type { Node, NodeChange, ReactFlowInstance } from "reactflow";
import "reactflow/dist/style.css";

type StorySentinelWarning = {
  code: string;
  message: string;
};

type StorySentinelData = {
  warnings: StorySentinelWarning[];
};

type DirectorResponse = {
  director_response: string;
  trace: string[];
  story_sentinel?: StorySentinelData;
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
  title?: string;
  summary?: string;
  notes?: string;
  sentinelWarnings?: StorySentinelWarning[];
};

type VoiceStatus = "idle" | "listening" | "processing" | "unsupported" | "error";

type BeatDraft = {
  id: string;
  title: string;
  summary: string;
  notes: string;
};

type SpeechRecognitionResultLike = {
  transcript: string;
};

type SpeechRecognitionEventLike = {
  results: SpeechRecognitionResultLike[][];
};

type SpeechRecognitionErrorEventLike = {
  error: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike;

type WindowWithSpeechRecognition = Window & {
  SpeechRecognition?: SpeechRecognitionConstructorLike;
  webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
};

const composeBeatLabel = (title: string, summary: string): string => {
  const normalizedTitle = title.trim() || "Untitled Beat";
  const normalizedSummary = summary.trim();
  return normalizedSummary
    ? `${normalizedTitle}: ${normalizedSummary}`
    : normalizedTitle;
};

const normalizeSentinelText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const LOCAL_GENERIC_TITLES = new Set([
  "beat",
  "scene",
  "story",
  "next",
  "idea",
  "moment",
  "untitled beat",
]);

const LOCAL_GENERIC_PATTERNS = [
  "continue",
  "next beat",
  "something happens",
  "move forward",
  "keep going",
  "what happens next",
];

const LOCAL_CONTEXT_KEYWORDS = new Set([
  "who",
  "where",
  "when",
  "because",
  "after",
  "before",
  "during",
  "inside",
  "outside",
  "city",
  "room",
  "forest",
  "ship",
  "king",
  "detective",
]);

const buildLocalSentinelWarnings = ({
  nodeId,
  title,
  summary,
  notes,
  nodes,
}: {
  nodeId: string;
  title: string;
  summary: string;
  notes: string;
  nodes: Node<StoryNodeData>[];
}): StorySentinelWarning[] => {
  const warnings: StorySentinelWarning[] = [];
  const normalizedTitle = normalizeSentinelText(title);
  const normalizedIntent = normalizeSentinelText(composeBeatLabel(title, summary));
  const normalizedContext = normalizeSentinelText(`${summary} ${notes}`);
  const contextWords = normalizedContext.split(" ").filter(Boolean);

  const hasDuplicate = nodes.some((node) => {
    if (node.id === nodeId) {
      return false;
    }
    const otherLabel = normalizeSentinelText(node.data.label);
    return otherLabel.length > 0 && otherLabel === normalizedIntent;
  });
  if (hasDuplicate) {
    warnings.push({
      code: "duplicate_or_near_duplicate_intent",
      message: "This beat looks very similar to an existing beat.",
    });
  }

  if (normalizedTitle.length < 6 || LOCAL_GENERIC_TITLES.has(normalizedTitle)) {
    warnings.push({
      code: "likely_vague_beat_title",
      message: "Beat title may be vague. Add a concrete subject or action.",
    });
  }

  const hasContextSignal =
    /\d/.test(`${summary} ${notes}`) ||
    contextWords.some((word) => LOCAL_CONTEXT_KEYWORDS.has(word));
  if (contextWords.length < 4 || !hasContextSignal) {
    warnings.push({
      code: "likely_missing_context_signal",
      message: "Add who/where/when details to reduce ambiguity.",
    });
  }

  const isGenericPattern = LOCAL_GENERIC_PATTERNS.some((pattern) =>
    normalizedIntent.includes(pattern),
  );
  const recentGenericCount = nodes.reduce((count, node) => {
    const text = normalizeSentinelText(node.data.label);
    const matches = LOCAL_GENERIC_PATTERNS.some((pattern) =>
      text.includes(pattern),
    );
    return matches ? count + 1 : count;
  }, 0);
  if (isGenericPattern && recentGenericCount >= 2) {
    warnings.push({
      code: "likely_escalation_flatness",
      message: "Recent beats use similar patterns. Consider a stronger escalation.",
    });
  }

  return warnings;
};

const toBeatDraft = (node: Node<StoryNodeData>): BeatDraft => ({
  id: node.id,
  title: node.data.title ?? node.data.label,
  summary: node.data.summary ?? "",
  notes: node.data.notes ?? "",
});

const toNode = (data: DirectorResponse): Node<StoryNodeData> => {
  const sentinelWarnings = data.story_sentinel?.warnings ?? [];
  return {
    id: data.node.id,
    position: { x: data.node.x, y: data.node.y },
    data: {
      label: data.node.label,
      title: data.node.label,
      summary: "",
      notes: "",
      sentinelWarnings,
    },
    type: "default",
  };
};

export default function App() {
  const [directorText, setDirectorText] = useState("Director offline.");
  const [trace, setTrace] = useState<string[]>([]);
  const [nodes, setNodes] = useState<Node<StoryNodeData>[]>([]);
  const [error, setError] = useState("");
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");
  const [voiceError, setVoiceError] = useState("");
  const [lastTranscript, setLastTranscript] = useState("");
  const [beatDraft, setBeatDraft] = useState<BeatDraft | null>(null);
  const [latestSentinelWarnings, setLatestSentinelWarnings] = useState<
    StorySentinelWarning[]
  >([]);
  const flowRef = useRef<ReactFlowInstance | null>(null);
  const hasInitialFitRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const selectedNodeIdRef = useRef<string | null>(null);
  const beatEditStartedRef = useRef(false);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
  }, []);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.selected),
    [nodes],
  );
  const selectedBeat = useMemo(
    () => (selectedNode ? toBeatDraft(selectedNode) : null),
    [selectedNode],
  );
  const isBeatDirty =
    !!beatDraft &&
    !!selectedBeat &&
    (beatDraft.title !== selectedBeat.title ||
      beatDraft.summary !== selectedBeat.summary ||
      beatDraft.notes !== selectedBeat.notes);
  const selectedBeatWarnings = selectedNode?.data.sentinelWarnings ?? [];
  const visibleSentinelWarnings = selectedNode
    ? selectedBeatWarnings
    : latestSentinelWarnings;
  const sentinelScopeLabel = selectedNode
    ? `Selected beat (${selectedNode.id})`
    : "Most recent action";

  const handleFlowInit = useCallback((instance: ReactFlowInstance) => {
    flowRef.current = instance;
  }, []);

  const appendTraceEvent = useCallback((event: string) => {
    setTrace((current) => [...current, event]);
  }, []);

  const sendDirectorInput = useCallback(async (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) {
      return;
    }

    setIsLoading(true);
    const response = await fetch("http://localhost:8000/director/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_input: trimmed }),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data: DirectorResponse = await response.json();
    setDirectorText(data.director_response);
    setTrace(data.trace);
    setLatestSentinelWarnings(data.story_sentinel?.warnings ?? []);
    setNodes((prev) => [
      ...prev,
      { ...toNode(data), id: `${data.node.id}-${Date.now()}` },
    ]);
    setError("");
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
        setLatestSentinelWarnings(data.story_sentinel?.warnings ?? []);
        setNodes([toNode(data)]);
        setError("");
      })
      .catch((err: Error) => {
        setDirectorText("Director failed to connect.");
        setTrace(["backend_unreachable"]);
        setLatestSentinelWarnings([]);
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

  useEffect(() => {
    const currentId = selectedNode?.id ?? null;
    if (currentId === selectedNodeIdRef.current) {
      return;
    }

    selectedNodeIdRef.current = currentId;
    beatEditStartedRef.current = false;

    if (!selectedNode) {
      setBeatDraft(null);
      return;
    }

    setBeatDraft(toBeatDraft(selectedNode));
    appendTraceEvent("node_selected");
  }, [appendTraceEvent, selectedNode]);

  const handleBeatFieldChange = useCallback(
    (field: keyof Omit<BeatDraft, "id">, value: string) => {
      if (!beatEditStartedRef.current) {
        beatEditStartedRef.current = true;
        appendTraceEvent("beat_edit_started");
      }

      setBeatDraft((current) => {
        if (!current) {
          return current;
        }
        return { ...current, [field]: value };
      });
    },
    [appendTraceEvent],
  );

  const handleBeatSave = useCallback(() => {
    if (!beatDraft) {
      return;
    }

    const title = beatDraft.title.trim() || "Untitled Beat";
    const summary = beatDraft.summary.trim();
    const notes = beatDraft.notes.trim();
    const nextLabel = composeBeatLabel(title, summary);
    const localWarnings = buildLocalSentinelWarnings({
      nodeId: beatDraft.id,
      title,
      summary,
      notes,
      nodes,
    });

    setNodes((current) =>
      current.map((node) =>
        node.id === beatDraft.id
          ? {
              ...node,
              data: {
                ...node.data,
                label: nextLabel,
                title,
                summary,
                notes,
                sentinelWarnings: localWarnings,
              },
            }
          : node,
      ),
    );
    setBeatDraft((current) =>
      current
        ? {
            ...current,
            title,
            summary,
            notes,
          }
        : current,
    );
    beatEditStartedRef.current = false;
    setLatestSentinelWarnings(localWarnings);
    appendTraceEvent("story_sentinel_checked");
    if (localWarnings.length > 0) {
      appendTraceEvent("story_sentinel_warning_added");
    } else {
      appendTraceEvent("story_sentinel_clear");
    }
    appendTraceEvent("beat_updated");
  }, [appendTraceEvent, beatDraft, nodes]);

  const handleBeatCancel = useCallback(() => {
    if (!selectedNode) {
      return;
    }

    beatEditStartedRef.current = false;
    setBeatDraft(toBeatDraft(selectedNode));
  }, [selectedNode]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sendDirectorInput(userInput)
      .then(() => {
        setUserInput("");
      })
      .catch((err: Error) => {
        setError(err.message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const handleMicClick = () => {
    if (voiceStatus === "listening" && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const speechWindow = window as WindowWithSpeechRecognition;
    const Recognition =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!Recognition) {
      setVoiceStatus("unsupported");
      setVoiceError("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;

    setVoiceError("");
    recognition.onstart = () => {
      setVoiceStatus("listening");
    };
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() ?? "";
      if (!transcript) {
        return;
      }
      setLastTranscript(transcript);
      setVoiceStatus("processing");
      sendDirectorInput(transcript)
        .then(() => {
          setVoiceStatus("idle");
        })
        .catch((err: Error) => {
          setError(err.message);
          setVoiceStatus("error");
          setVoiceError(`Voice request failed: ${err.message}`);
        })
        .finally(() => {
          setIsLoading(false);
        });
    };
    recognition.onerror = (event) => {
      setVoiceStatus("error");
      setVoiceError(`Speech error: ${event.error}`);
    };
    recognition.onend = () => {
      setVoiceStatus((current) =>
        current === "listening" ? "idle" : current,
      );
    };

    try {
      recognition.start();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to start mic.";
      setVoiceStatus("error");
      setVoiceError(message);
    }
  };

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
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
          <h2 style={{ marginTop: 0, marginBottom: "8px" }}>Voice Input (Temporary)</h2>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              onClick={handleMicClick}
              disabled={isLoading || voiceStatus === "processing"}
              style={{
                height: "32px",
                borderRadius: "6px",
                border: "1px solid #3c4252",
                background: voiceStatus === "listening" ? "#573232" : "#222837",
                color: "#f5f7fa",
                padding: "0 10px",
                cursor:
                  isLoading || voiceStatus === "processing" ? "not-allowed" : "pointer",
              }}
            >
              {voiceStatus === "listening" ? "Stop Mic" : "Start Mic"}
            </button>
            <span style={{ fontSize: "12px", color: "#9aa0ad" }}>
              Status: {voiceStatus}
            </span>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#b8bfcd" }}>
            Latest transcript: {lastTranscript || "None yet"}
          </p>
          {voiceError ? (
            <p style={{ color: "#ff8a80", fontSize: "14px", marginBottom: 0 }}>
              {voiceError}
            </p>
          ) : null}
        </section>

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
          <h3 style={{ marginTop: 0, marginBottom: "12px" }}>Selected Beat</h3>
          {selectedNode && beatDraft ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleBeatSave();
              }}
              style={{
                border: "1px solid #2b2f3a",
                borderRadius: "8px",
                padding: "10px",
                background: "#111318",
                display: "grid",
                gap: "10px",
              }}
            >
              <label
                style={{
                  display: "grid",
                  gap: "4px",
                  fontSize: "12px",
                  color: "#9aa0ad",
                }}
              >
                Beat ID
                <input
                  readOnly
                  value={beatDraft.id}
                  style={{
                    height: "28px",
                    borderRadius: "6px",
                    border: "1px solid #2b2f3a",
                    background: "#0f1115",
                    color: "#9aa0ad",
                    padding: "0 8px",
                  }}
                />
              </label>

              <label
                style={{
                  display: "grid",
                  gap: "4px",
                  fontSize: "12px",
                  color: "#9aa0ad",
                }}
              >
                Title
                <input
                  value={beatDraft.title}
                  onChange={(event) =>
                    handleBeatFieldChange("title", event.target.value)
                  }
                  style={{
                    height: "28px",
                    borderRadius: "6px",
                    border: "1px solid #2b2f3a",
                    background: "#0f1115",
                    color: "#f5f7fa",
                    padding: "0 8px",
                  }}
                />
              </label>

              <label
                style={{
                  display: "grid",
                  gap: "4px",
                  fontSize: "12px",
                  color: "#9aa0ad",
                }}
              >
                Summary
                <textarea
                  value={beatDraft.summary}
                  onChange={(event) =>
                    handleBeatFieldChange("summary", event.target.value)
                  }
                  rows={2}
                  style={{
                    borderRadius: "6px",
                    border: "1px solid #2b2f3a",
                    background: "#0f1115",
                    color: "#f5f7fa",
                    padding: "6px 8px",
                    resize: "vertical",
                  }}
                />
              </label>

              <label
                style={{
                  display: "grid",
                  gap: "4px",
                  fontSize: "12px",
                  color: "#9aa0ad",
                }}
              >
                Notes (Optional)
                <textarea
                  value={beatDraft.notes}
                  onChange={(event) =>
                    handleBeatFieldChange("notes", event.target.value)
                  }
                  rows={3}
                  style={{
                    borderRadius: "6px",
                    border: "1px solid #2b2f3a",
                    background: "#0f1115",
                    color: "#f5f7fa",
                    padding: "6px 8px",
                    resize: "vertical",
                  }}
                />
              </label>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="submit"
                  disabled={!isBeatDirty}
                  style={{
                    height: "30px",
                    borderRadius: "6px",
                    border: "1px solid #3c4252",
                    background: isBeatDirty ? "#222837" : "#1a1e27",
                    color: "#f5f7fa",
                    padding: "0 10px",
                    cursor: isBeatDirty ? "pointer" : "not-allowed",
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={handleBeatCancel}
                  disabled={!isBeatDirty}
                  style={{
                    height: "30px",
                    borderRadius: "6px",
                    border: "1px solid #3c4252",
                    background: isBeatDirty ? "#1e2431" : "#1a1e27",
                    color: "#f5f7fa",
                    padding: "0 10px",
                    cursor: isBeatDirty ? "pointer" : "not-allowed",
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <p style={{ margin: 0, color: "#9aa0ad", fontSize: "14px" }}>
              No node selected.
            </p>
          )}
        </section>

        <section style={{ marginBottom: "24px" }}>
          <h3 style={{ marginTop: 0, marginBottom: "8px" }}>Story Sentinel</h3>
          <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#9aa0ad" }}>
            Scope: {sentinelScopeLabel}
          </p>
          {visibleSentinelWarnings.length > 0 ? (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "8px" }}>
              {visibleSentinelWarnings.map((warning, index) => (
                <li
                  key={`${warning.code}-${index}`}
                  style={{
                    border: "1px solid #5a4b2a",
                    borderRadius: "8px",
                    background: "#2a2418",
                    padding: "8px",
                  }}
                >
                  <p style={{ margin: "0 0 4px", fontSize: "12px", color: "#e9d8a6" }}>
                    {warning.code}
                  </p>
                  <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.4 }}>
                    {warning.message}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0, color: "#9aa0ad", fontSize: "14px" }}>
              No Story Sentinel warnings.
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
