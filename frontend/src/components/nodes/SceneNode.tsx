import { memo } from "react";
import type { NodeProps } from "reactflow";
import { Handle, Position } from "reactflow";

type SceneNodeData = {
  title: string;
  description: string;
  mood: string;
  directorNotes: string;
  imageUrl?: string;
  imageLoading?: boolean;
};

const MOOD_COLORS: Record<string, string> = {
  tense: "#FF6B6B",
  calm: "#6BCB77",
  joyful: "#FFD93D",
  mysterious: "#9B59B6",
  dramatic: "#D4A017",
  melancholic: "#5DADE2",
  suspenseful: "#E67E22",
  romantic: "#FF69B4",
};

const MOOD_EMOJI: Record<string, string> = {
  tense: "😰",
  calm: "🧘",
  joyful: "😊",
  mysterious: "🔮",
  dramatic: "🎭",
  melancholic: "🌧",
  suspenseful: "⏱",
  romantic: "❤️",
};

function SceneNodeComponent({ data }: NodeProps<SceneNodeData>) {
  const moodColor = MOOD_COLORS[data.mood] ?? "#D4A017";
  const moodEmoji = MOOD_EMOJI[data.mood] ?? "🎬";

  return (
    <div
      style={{
        width: 260,
        background: "#1A1A2E",
        border: `1px solid ${moodColor}44`,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: `0 4px 20px ${moodColor}15`,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: moodColor }} />
      <Handle type="source" position={Position.Right} style={{ background: moodColor }} />

      {/* Image area */}
      <div
        style={{
          width: "100%",
          height: 140,
          background: data.imageUrl
            ? `url(${data.imageUrl}) center/cover`
            : "#0D0D0D",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {data.imageLoading && !data.imageUrl && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              color: "#888",
              fontSize: 12,
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                border: "2px solid #333",
                borderTopColor: moodColor,
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            />
            <span>Generating storyboard...</span>
          </div>
        )}
        {!data.imageLoading && !data.imageUrl && (
          <span style={{ color: "#444", fontSize: 32 }}>🎬</span>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: "10px 12px" }}>
        {/* Title + mood badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <h4
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 600,
              color: "#E8E8E8",
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {data.title || "Untitled Scene"}
          </h4>
          <span
            style={{
              fontSize: 10,
              padding: "2px 6px",
              borderRadius: 6,
              background: `${moodColor}22`,
              color: moodColor,
              fontWeight: 600,
              whiteSpace: "nowrap",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {moodEmoji} {data.mood}
          </span>
        </div>

        {/* Description */}
        {data.description && (
          <p
            style={{
              margin: "0 0 6px 0",
              fontSize: 11,
              color: "#AAA",
              lineHeight: 1.4,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {data.description}
          </p>
        )}

        {/* Director notes */}
        {data.directorNotes && (
          <p
            style={{
              margin: 0,
              fontSize: 10,
              color: "#D4A017",
              fontStyle: "italic",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            📝 {data.directorNotes}
          </p>
        )}
      </div>
    </div>
  );
}

export const SceneNode = memo(SceneNodeComponent);
