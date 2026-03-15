import { useEffect, useState, useCallback } from "react";
import type { Scene } from "../hooks/useStoryState";

type StatusBarProps = {
  connectionStatus: "idle" | "connecting" | "connected" | "error";
  sceneCount: number;
  characterCount: number;
  activeScene?: Scene;
  onSendText?: (text: string) => void;
};

const STATUS_COLORS: Record<string, string> = {
  idle: "#666",
  connecting: "#D4A017",
  connected: "#4CAF50",
  error: "#FF5252",
};

const MOOD_COLORS: Record<string, string> = {
  tense: "#FF6B6B",
  calm: "#6BC5FF",
  joyful: "#FFD93D",
  mysterious: "#B388FF",
  dramatic: "#FF8A65",
  melancholic: "#90A4AE",
  suspenseful: "#FF5252",
  romantic: "#F48FB1",
};

export function StatusBar({ connectionStatus, sceneCount, characterCount, activeScene, onSendText }: StatusBarProps) {
  const [elapsed, setElapsed] = useState(0);
  const [textInput, setTextInput] = useState("");

  useEffect(() => {
    if (connectionStatus !== "connected") return;
    const start = Date.now();
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [connectionStatus]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timer = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = textInput.trim();
      if (trimmed && onSendText) {
        onSendText(trimmed);
        setTextInput("");
      }
    },
    [textInput, onSendText],
  );

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 48,
        background: "#0D0D0D",
        borderBottom: "1px solid #2B2F3A",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 16,
        zIndex: 200,
        fontSize: 13,
      }}
    >
      {/* Left: branding */}
      <span style={{ color: "#D4A017", fontWeight: 700, letterSpacing: 2 }}>DIRECTOR MODE</span>
      <span style={{ color: "#888", fontSize: 11 }}>powered by Gemini</span>

      {/* Center: active scene + mood */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {activeScene ? (
          <>
            <span style={{ color: "#E8E8E8", fontSize: 12, fontWeight: 600 }}>
              {activeScene.title}
            </span>
            <span
              style={{
                background: MOOD_COLORS[activeScene.mood] ?? "#D4A017",
                color: "#0D0D0D",
                borderRadius: 99,
                padding: "1px 8px",
                fontSize: 10,
                fontWeight: 600,
                textTransform: "capitalize",
              }}
            >
              {activeScene.mood}
            </span>
          </>
        ) : null}

        {/* Text input fallback */}
        {onSendText ? (
          <form onSubmit={handleSubmit} style={{ display: "flex", marginLeft: 12 }}>
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type a direction..."
              data-text-input
              style={{
                background: "#1A1A2E",
                border: "1px solid #2B2F3A",
                borderRadius: 6,
                color: "#E8E8E8",
                padding: "4px 10px",
                fontSize: 12,
                width: 200,
                outline: "none",
              }}
            />
          </form>
        ) : null}
      </div>

      {/* Right: status, counts, timer */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
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
          <span style={{ color: "#666", fontFamily: "monospace" }}>{timer}</span>
        ) : null}
      </div>
    </div>
  );
}
