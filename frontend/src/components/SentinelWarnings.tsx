import { useEffect, useState } from "react";
import type { StorySentinelWarning } from "../services/storySentinel";

type Toast = StorySentinelWarning & { id: number };

const CODE_COLORS: Record<string, string> = {
  duplicate_or_near_duplicate_intent: "#FF6B6B",
  likely_vague_beat_title: "#FFD93D",
  likely_missing_context_signal: "#6BC5FF",
  likely_escalation_flatness: "#FF8A65",
  three_clue_underconnected: "#B388FF",
  three_clue_no_thread_continuity: "#7C4DFF",
};

let nextId = 0;

type SentinelWarningsProps = {
  warnings: StorySentinelWarning[];
};

export function SentinelWarnings({ warnings }: SentinelWarningsProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    if (warnings.length === 0) return;
    const newToasts = warnings.map((w) => ({ ...w, id: nextId++ }));
    setToasts((prev) => [...prev, ...newToasts]);

    const ids = newToasts.map((t) => t.id);
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => !ids.includes(t.id)));
    }, 5000);
    return () => clearTimeout(timer);
  }, [warnings]);

  if (toasts.length === 0) return null;

  return (
    <div style={{ position: "fixed", top: 52, right: 16, zIndex: 300, display: "flex", flexDirection: "column", gap: 8 }}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            background: "#1A1A2E",
            border: `1px solid ${CODE_COLORS[toast.code] ?? "#D4A017"}`,
            borderLeft: `4px solid ${CODE_COLORS[toast.code] ?? "#D4A017"}`,
            borderRadius: 8,
            padding: "10px 14px",
            color: "#E8E8E8",
            fontSize: 12,
            maxWidth: 320,
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 11, color: CODE_COLORS[toast.code] ?? "#D4A017", marginBottom: 4 }}>
            {toast.code.replace(/_/g, " ").toUpperCase()}
          </div>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
