import { useEffect, useState } from "react";

type StatusBarProps = {
  connectionStatus: "idle" | "connecting" | "connected" | "error";
  sceneCount: number;
  characterCount: number;
};

const STATUS_COLORS: Record<string, string> = {
  idle: "#666",
  connecting: "#D4A017",
  connected: "#4CAF50",
  error: "#FF5252",
};

export function StatusBar({ connectionStatus, sceneCount, characterCount }: StatusBarProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (connectionStatus !== "connected") return;
    const start = Date.now();
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [connectionStatus]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timer = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 40,
        background: "#1A1A2E",
        borderBottom: "1px solid #2B2F3A",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 16,
        zIndex: 200,
        fontSize: 13,
      }}
    >
      <span style={{ color: "#D4A017", fontWeight: 700, letterSpacing: 2 }}>DIRECTOR MODE</span>
      <span style={{ color: "#666", fontSize: 11 }}>powered by Gemini</span>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: STATUS_COLORS[connectionStatus] ?? "#666",
          display: "inline-block",
        }}
      />
      <span style={{ color: "#888" }}>
        {sceneCount} scene{sceneCount !== 1 ? "s" : ""} · {characterCount} char{characterCount !== 1 ? "s" : ""}
      </span>
      {connectionStatus === "connected" ? (
        <span style={{ color: "#666", marginLeft: "auto", fontFamily: "monospace" }}>{timer}</span>
      ) : null}
    </div>
  );
}
