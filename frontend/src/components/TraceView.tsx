import { useEffect, useRef, useState } from "react";
import type { TraceEvent } from "../hooks/useStoryState";

type TraceViewProps = {
  events: TraceEvent[];
};

const TYPE_STYLES: Record<string, { icon: string; color: string }> = {
  user_input: { icon: "🎤", color: "#E8E8E8" },
  model_responding: { icon: "🤖", color: "#D4A017" },
  tool_call: { icon: "🔧", color: "#5DADE2" },
  scene_created: { icon: "🎬", color: "#4CAF50" },
  character_introduced: { icon: "🧑", color: "#9B59B6" },
  storyboard_queued: { icon: "🖼️", color: "#E67E22" },
  storyboard_complete: { icon: "✅", color: "#4CAF50" },
  sentinel_warning: { icon: "🛡️", color: "#FFD93D" },
  error: { icon: "❌", color: "#FF6B6B" },
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function TraceView({ events }: TraceViewProps) {
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div
      style={{
        position: "fixed",
        top: 36,
        right: 0,
        bottom: 0,
        width: collapsed ? 36 : 320,
        background: "#0D0D0D",
        borderLeft: "1px solid #1A1A2E",
        display: "flex",
        flexDirection: "column",
        zIndex: 150,
        transition: "width 0.2s ease",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: collapsed ? "8px 6px" : "8px 12px",
          borderBottom: "1px solid #1A1A2E",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          minHeight: 36,
        }}
      >
        {!collapsed && (
          <span style={{ color: "#D4A017", fontWeight: 600, fontSize: 11, letterSpacing: "1px" }}>
            TRACE VIEW
          </span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          style={{
            background: "none",
            border: "none",
            color: "#888",
            cursor: "pointer",
            fontSize: 14,
            padding: 2,
          }}
        >
          {collapsed ? "◀" : "▶"}
        </button>
      </div>

      {/* Event list */}
      {!collapsed && (
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "4px 0",
          }}
        >
          {events.length === 0 && (
            <p style={{ color: "#555", fontSize: 11, padding: "12px", textAlign: "center" }}>
              Waiting for agent activity...
            </p>
          )}
          {events.map((event) => {
            const style = TYPE_STYLES[event.type] ?? { icon: "📌", color: "#888" };
            return (
              <div
                key={event.id}
                style={{
                  padding: "4px 10px",
                  borderBottom: "1px solid #111",
                  display: "flex",
                  gap: 6,
                  alignItems: "flex-start",
                  fontSize: 11,
                  lineHeight: 1.5,
                }}
              >
                <span style={{ color: "#555", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {formatTime(event.timestamp)}
                </span>
                <span style={{ flexShrink: 0 }}>{style.icon}</span>
                <span style={{ color: style.color, wordBreak: "break-word" }}>
                  {event.message}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
