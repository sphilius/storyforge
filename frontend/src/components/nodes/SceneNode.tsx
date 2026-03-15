import { memo, useState } from "react";
import { Handle, Position } from "reactflow";
import type { NodeProps } from "reactflow";

type SceneNodeData = {
  title: string;
  mood: string;
  description: string;
  directorNotes?: string;
  imageUrl?: string;
  imageLoading?: boolean;
  imageError?: boolean;
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

function SceneNodeComponent({ data }: NodeProps<SceneNodeData>) {
  const [hovered, setHovered] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const moodColor = MOOD_COLORS[data.mood] ?? "#D4A017";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#1A1A2E",
        border: `1px solid ${hovered ? "#D4A017" : "#2B2F3A"}`,
        borderRadius: 12,
        padding: 12,
        minWidth: 280,
        color: "#E8E8E8",
        boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
        transition: "border-color 0.2s",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: "#D4A017" }} />

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span
          style={{
            fontWeight: 700,
            fontSize: 14,
            color: "#D4A017",
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {data.title}
        </span>
        <span
          style={{
            background: moodColor,
            color: "#0D0D0D",
            borderRadius: 99,
            padding: "2px 10px",
            fontSize: 11,
            fontWeight: 600,
            textTransform: "capitalize",
            flexShrink: 0,
          }}
        >
          {data.mood}
        </span>
      </div>

      <p
        style={{
          fontSize: 12,
          color: "#AAA",
          margin: "0 0 8px",
          lineHeight: 1.4,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {data.description}
      </p>

      {data.imageLoading ? (
        <div
          style={{
            height: 160,
            background: "linear-gradient(90deg, #2B2F3A 25%, #3a3f4e 50%, #2B2F3A 75%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.5s infinite",
            borderRadius: 8,
          }}
        />
      ) : data.imageError ? (
        <div
          style={{
            height: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            color: "#555",
            borderRadius: 8,
            background: "#1f1f30",
          }}
        >
          Image unavailable
        </div>
      ) : data.imageUrl ? (
        <img
          src={data.imageUrl}
          alt={data.title}
          style={{
            width: "100%",
            maxHeight: 160,
            objectFit: "cover",
            borderRadius: 8,
          }}
        />
      ) : null}

      {data.directorNotes ? (
        <div style={{ marginTop: 8 }}>
          <button
            type="button"
            onClick={() => setNotesOpen((v) => !v)}
            style={{
              background: "none",
              border: "none",
              color: "#666",
              cursor: "pointer",
              fontSize: 11,
              padding: 0,
            }}
          >
            {notesOpen ? "▾ Director Notes" : "▸ Director Notes"}
          </button>
          {notesOpen ? (
            <p style={{ fontSize: 11, color: "#888", margin: "4px 0 0", lineHeight: 1.4 }}>
              {data.directorNotes}
            </p>
          ) : null}
        </div>
      ) : null}

      <Handle type="source" position={Position.Right} style={{ background: "#D4A017" }} />
    </div>
  );
}

export const SceneNode = memo(SceneNodeComponent);
