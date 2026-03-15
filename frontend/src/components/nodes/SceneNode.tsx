import { memo } from "react";
import { Handle, Position } from "reactflow";
import type { NodeProps } from "reactflow";

type SceneNodeData = {
  title: string;
  mood: string;
  description: string;
  imageUrl?: string;
  imageLoading?: boolean;
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
  const moodColor = MOOD_COLORS[data.mood] ?? "#D4A017";

  return (
    <div
      style={{
        background: "#1A1A2E",
        border: "1px solid #2B2F3A",
        borderRadius: 12,
        padding: 12,
        width: 280,
        color: "#E8E8E8",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: "#D4A017" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
          }}
        >
          {data.mood}
        </span>
      </div>
      <p style={{ fontSize: 12, color: "#AAA", margin: "0 0 8px", lineHeight: 1.4, maxHeight: 56, overflow: "hidden" }}>
        {data.description}
      </p>
      {data.imageLoading ? (
        <div
          style={{
            height: 120,
            background: "#2B2F3A",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            color: "#666",
          }}
        >
          Generating...
        </div>
      ) : data.imageUrl ? (
        <img
          src={data.imageUrl}
          alt={data.title}
          style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 8 }}
        />
      ) : null}
      <Handle type="source" position={Position.Right} style={{ background: "#D4A017" }} />
    </div>
  );
}

export const SceneNode = memo(SceneNodeComponent);
