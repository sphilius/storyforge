import { useEffect, useRef } from "react";
import type { TraceEvent } from "../hooks/useStoryState";

const TYPE_COLORS: Record<string, string> = {
  user_input: "#6BC5FF",
  model_responding: "#D4A017",
  tool_call: "#B388FF",
  scene_created: "#4CAF50",
  character_introduced: "#7C4DFF",
  storyboard_queued: "#FFD93D",
  storyboard_complete: "#4CAF50",
  sentinel_warning: "#FF6B6B",
  error: "#FF5252",
};

const TYPE_ICONS: Record<string, string> = {
  user_input: "🎙",
  model_responding: "🎬",
  tool_call: "⚙",
  scene_created: "🎭",
  character_introduced: "👤",
  storyboard_queued: "🖼",
  storyboard_complete: "✅",
  sentinel_warning: "⚠",
  error: "❌",
};

type TraceViewProps = {
  events: TraceEvent[];
  open: boolean;
  onToggle: () => void;
};

export function TraceView({ events, open, onToggle }: TraceViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <aside
      style={{
        width: open ? 340 : 40,
        background: "#1A1A2E",
        borderLeft: "1px solid #2B2F3A",
        transition: "width 0.2s",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          background: "none",
          border: "none",
          color: "#D4A017",
          padding: 10,
          cursor: "pointer",
          textAlign: "left",
          fontSize: 14,
          fontWeight: 700,
          borderBottom: "1px solid #2B2F3A",
        }}
      >
        {open ? "◀ Trace" : "▶"}
      </button>
      {open ? (
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 10 }}>
          {events.map((ev) => {
            const color = TYPE_COLORS[ev.type] ?? "#888";
            const icon = TYPE_ICONS[ev.type] ?? "•";
            const time = new Date(ev.timestamp).toLocaleTimeString();
            return (
              <div
                key={ev.id}
                style={{
                  marginBottom: 8,
                  fontFamily: "monospace",
                  fontSize: 11,
                  lineHeight: 1.4,
                }}
              >
                <span style={{ color: "#666" }}>{time}</span>{" "}
                <span>{icon}</span>{" "}
                <span style={{ color }}>{ev.message}</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </aside>
  );
}
