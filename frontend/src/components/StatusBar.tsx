import { useEffect, useRef, useState } from "react";

type StatusBarProps = {
  status: "idle" | "connecting" | "connected" | "error";
  sceneCount: number;
  characterCount: number;
};

const STATUS_DOTS: Record<string, string> = {
  idle: "#555",
  connecting: "#D4A017",
  connected: "#4CAF50",
  error: "#FF6B6B",
};

export function StatusBar({ status, sceneCount, characterCount }: StatusBarProps) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (status === "connected" && !startRef.current) {
      startRef.current = Date.now();
    }
    if (status === "idle" || status === "error") {
      startRef.current = null;
      setElapsed(0);
    }
  }, [status]);

  useEffect(() => {
    if (status !== "connected") return;
    const interval = setInterval(() => {
      if (startRef.current) {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 36,
        background: "#0D0D0D",
        borderBottom: "1px solid #1A1A2E",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        zIndex: 200,
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: 12,
      }}
    >
      {/* Left: Branding */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ color: "#D4A017", fontWeight: 700, fontSize: 13, letterSpacing: "1px" }}>
          DIRECTOR MODE
        </span>
        <span style={{ color: "#555", fontSize: 11 }}>powered by Gemini</span>
      </div>

      {/* Right: Status indicators */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ color: "#888" }}>🎬 {sceneCount}</span>
        <span style={{ color: "#888" }}>🧑 {characterCount}</span>
        {status === "connected" && (
          <span style={{ color: "#888", fontVariantNumeric: "tabular-nums" }}>
            {minutes}:{seconds}
          </span>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: STATUS_DOTS[status],
              display: "inline-block",
              boxShadow: status === "connected" ? "0 0 6px #4CAF50" : undefined,
            }}
          />
          <span style={{ color: STATUS_DOTS[status], fontSize: 11, textTransform: "uppercase" }}>
            {status}
          </span>
        </div>
      </div>
    </div>
  );
}
