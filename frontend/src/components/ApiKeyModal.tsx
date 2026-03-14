import { useState } from "react";

type ApiKeyModalProps = {
  open: boolean;
  status: "idle" | "connecting" | "connected" | "error";
  onConnect: (apiKey: string) => void;
  onDismiss: () => void;
  errorMessage?: string;
};

const MODEL_OPTIONS = ["gemini-2.5-flash-native-audio-preview-12-2025"];
const API_KEY_STORAGE_KEY = "storyforge:gemini-api-key";
const MODEL_STORAGE_KEY = "storyforge:live-model";

export const ApiKeyModal = ({
  open,
  status,
  onConnect,
  onDismiss,
  errorMessage,
}: ApiKeyModalProps) => {
  const [apiKey, setApiKey] = useState<string>(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.localStorage.getItem(API_KEY_STORAGE_KEY) ?? "";
  });
  const [rememberKey, setRememberKey] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return Boolean(window.localStorage.getItem(API_KEY_STORAGE_KEY));
  });
  const [model, setModel] = useState<string>(() => {
    if (typeof window === "undefined") {
      return MODEL_OPTIONS[0];
    }
    return window.localStorage.getItem(MODEL_STORAGE_KEY) ?? MODEL_OPTIONS[0];
  });
  const [showKey, setShowKey] = useState(false);

  if (!open) {
    return null;
  }

  const handleConnect = () => {
    if (!apiKey.trim()) {
      return;
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(MODEL_STORAGE_KEY, model);
      if (rememberKey) {
        window.localStorage.setItem(API_KEY_STORAGE_KEY, apiKey.trim());
      } else {
        window.localStorage.removeItem(API_KEY_STORAGE_KEY);
      }
    }

    onConnect(apiKey.trim());
  };

  const statusIndicator =
    status === "connecting"
      ? { color: "#D4A017", label: "Connecting..." }
      : status === "connected"
        ? { color: "#4CAF50", label: "Connected" }
        : status === "error"
          ? { color: "#FF6B6B", label: errorMessage ?? "Connection failed" }
          : { color: "#888888", label: "Idle" };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          width: "min(520px, 90vw)",
          background: "#1A1A2E",
          border: "1px solid #2b2b42",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.45)",
          color: "#E8E8E8",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>Connect Gemini Live API</h2>
        <p style={{ marginTop: 0, marginBottom: 20, color: "#888888" }}>
          Enter your Gemini API key to enable direct browser voice sessions.
        </p>

        <label style={{ display: "block", marginBottom: 8 }}>Gemini API Key</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="AIza..."
            style={{
              flex: 1,
              borderRadius: 10,
              border: "1px solid #343455",
              background: "#0D0D0D",
              color: "#E8E8E8",
              padding: "10px 12px",
            }}
          />
          <button
            type="button"
            onClick={() => setShowKey((current) => !current)}
            style={{
              border: "1px solid #343455",
              background: "#111118",
              color: "#E8E8E8",
              borderRadius: 10,
              padding: "0 12px",
            }}
          >
            {showKey ? "Hide" : "Show"}
          </button>
        </div>

        <label style={{ display: "block", marginBottom: 8 }}>Live model</label>
        <select
          value={model}
          onChange={(event) => setModel(event.target.value)}
          style={{
            width: "100%",
            marginBottom: 16,
            borderRadius: 10,
            border: "1px solid #343455",
            background: "#0D0D0D",
            color: "#E8E8E8",
            padding: "10px 12px",
          }}
        >
          {MODEL_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 20,
            color: "#C7C7C7",
          }}
        >
          <input
            type="checkbox"
            checked={rememberKey}
            onChange={(event) => setRememberKey(event.target.checked)}
          />
          Remember key on this device
        </label>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: statusIndicator.color }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: statusIndicator.color,
                display: "inline-block",
              }}
            />
            <span>{statusIndicator.label}</span>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            {status === "connected" ? (
              <button
                type="button"
                onClick={onDismiss}
                style={{
                  border: "1px solid #343455",
                  color: "#E8E8E8",
                  background: "#151525",
                  borderRadius: 10,
                  padding: "10px 14px",
                }}
              >
                Close
              </button>
            ) : null}

            <button
              type="button"
              disabled={status === "connecting" || apiKey.trim().length === 0}
              onClick={handleConnect}
              style={{
                border: "none",
                color: "#0D0D0D",
                background: "#D4A017",
                borderRadius: 10,
                padding: "10px 14px",
                fontWeight: 700,
                opacity: status === "connecting" ? 0.75 : 1,
              }}
            >
              {status === "connecting" ? "Connecting..." : "Connect"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
