type VoiceButtonProps = {
  state: "idle" | "recording" | "playing";
  onClick: () => void;
};

const STATE_STYLES: Record<string, { bg: string; shadow: string }> = {
  idle: { bg: "#555", shadow: "none" },
  recording: { bg: "#FF4444", shadow: "0 0 20px rgba(255,68,68,0.6)" },
  playing: { bg: "#D4A017", shadow: "0 0 20px rgba(212,160,23,0.6)" },
};

export function VoiceButton({ state, onClick }: VoiceButtonProps) {
  const style = STATE_STYLES[state] ?? STATE_STYLES.idle;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: "fixed",
        bottom: 32,
        left: "50%",
        transform: "translateX(-50%)",
        width: 64,
        height: 64,
        borderRadius: "50%",
        border: "none",
        background: style.bg,
        boxShadow: style.shadow,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        transition: "all 0.2s",
        animation: state === "recording" ? "pulse 1.5s infinite" : state === "playing" ? "pulse-amber 1.5s infinite" : "none",
      }}
      title={state === "recording" ? "Stop recording" : "Start recording"}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E8E8E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {state === "recording" ? (
          <rect x="6" y="6" width="12" height="12" rx="2" fill="#E8E8E8" />
        ) : (
          <>
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </>
        )}
      </svg>
    </button>
  );
}
