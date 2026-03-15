import { useEffect, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Cpu,
  Wrench,
  Film,
  User,
  Image,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import type { TraceEvent } from "../hooks/useStoryState";

const TYPE_CONFIG: Record<string, { color: string; Icon: typeof MessageSquare }> = {
  user_input: { color: "#6BC5FF", Icon: MessageSquare },
  model_responding: { color: "#D4A017", Icon: Cpu },
  tool_call: { color: "#4CAF50", Icon: Wrench },
  scene_created: { color: "#10B981", Icon: Film },
  character_introduced: { color: "#6C3483", Icon: User },
  storyboard_queued: { color: "#FFD93D", Icon: Image },
  storyboard_complete: { color: "#4CAF50", Icon: CheckCircle },
  sentinel_warning: { color: "#FF6B6B", Icon: AlertTriangle },
  error: { color: "#FF5252", Icon: XCircle },
};

type TraceViewProps = {
  events: TraceEvent[];
  open: boolean;
  onToggle: () => void;
};

export function TraceView({ events, open, onToggle }: TraceViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  const formatTime = (ts: number): string => {
    const d = new Date(ts);
    return d.toTimeString().slice(0, 8);
  };

  return (
    <aside
      style={{
        width: open ? 320 : 40,
        background: "#111318",
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
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {open ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        {open ? "Trace" : ""}
      </button>
      {open ? (
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 10 }}>
          {events.map((ev) => {
            const config = TYPE_CONFIG[ev.type];
            const color = config?.color ?? "#888";
            const IconComp = config?.Icon;
            return (
              <div
                key={ev.id}
                style={{
                  padding: "6px 0",
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  fontSize: 11,
                  lineHeight: 1.4,
                  borderBottom: "1px solid #2B2F3A",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 6,
                }}
              >
                <span style={{ color: "#555", flexShrink: 0 }}>[{formatTime(ev.timestamp)}]</span>
                {IconComp ? <IconComp size={12} color={color} style={{ flexShrink: 0, marginTop: 2 }} /> : null}
                <span style={{ color }}>{ev.message}</span>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      ) : null}
    </aside>
  );
}
