import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { StorySentinelWarning } from "../services/storySentinel";

type Toast = StorySentinelWarning & { id: number; fading: boolean };

const CODE_BG_COLORS: Record<string, string> = {
  duplicate_or_near_duplicate_intent: "rgba(212,160,23,0.15)",
  likely_vague_beat_title: "rgba(255,217,61,0.15)",
  likely_missing_context_signal: "rgba(255,165,0,0.15)",
  likely_escalation_flatness: "rgba(255,82,82,0.15)",
};

const CODE_BORDER_COLORS: Record<string, string> = {
  duplicate_or_near_duplicate_intent: "#D4A017",
  likely_vague_beat_title: "#FFD93D",
  likely_missing_context_signal: "#FF8A65",
  likely_escalation_flatness: "#FF5252",
};

let nextId = 0;

type SentinelWarningsProps = {
  warnings: StorySentinelWarning[];
};

export function SentinelWarnings({ warnings }: SentinelWarningsProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    if (warnings.length === 0) return;
    const newToasts: Toast[] = warnings.map((w) => ({ ...w, id: nextId++, fading: false }));

    setToasts((prev) => {
      const combined = [...prev, ...newToasts];
      // Max 3 visible: dismiss oldest first
      if (combined.length > 3) {
        return combined.slice(combined.length - 3);
      }
      return combined;
    });

    const ids = newToasts.map((t) => t.id);

    // Start fade-out at 4.5s
    const fadeTimer = setTimeout(() => {
      setToasts((prev) => prev.map((t) => (ids.includes(t.id) ? { ...t, fading: true } : t)));
    }, 4500);

    // Remove at 5s
    const removeTimer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => !ids.includes(t.id)));
    }, 5000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [warnings]);

  const dismiss = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div style={{ position: "fixed", top: 56, right: 16, zIndex: 300, display: "flex", flexDirection: "column", gap: 8 }}>
      {toasts.map((toast) => {
        const bg = CODE_BG_COLORS[toast.code] ?? "rgba(212,160,23,0.15)";
        const border = CODE_BORDER_COLORS[toast.code] ?? "#D4A017";
        return (
          <div
            key={toast.id}
            style={{
              background: bg,
              border: `1px solid ${border}`,
              borderLeft: `4px solid ${border}`,
              borderRadius: 8,
              padding: "10px 14px",
              color: "#E8E8E8",
              fontSize: 12,
              maxWidth: 320,
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              opacity: toast.fading ? 0 : 1,
              transition: "opacity 0.5s",
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <AlertTriangle size={14} color={border} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 11, color: border, marginBottom: 4 }}>
                {toast.code.replace(/_/g, " ").toUpperCase()}
              </div>
              {toast.message}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              style={{
                background: "none",
                border: "none",
                color: "#666",
                cursor: "pointer",
                padding: 0,
                flexShrink: 0,
              }}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
