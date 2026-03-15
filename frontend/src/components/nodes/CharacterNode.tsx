import { memo } from "react";
import type { NodeProps } from "reactflow";
import { Handle, Position } from "reactflow";

type CharacterNodeData = {
  name: string;
  description: string;
  motivation: string;
};

function CharacterNodeComponent({ data }: NodeProps<CharacterNodeData>) {
  return (
    <div
      style={{
        width: 220,
        background: "#1A1A2E",
        border: "1px solid #9B59B644",
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 4px 20px rgba(155, 89, 182, 0.08)",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: "#9B59B6" }} />
      <Handle type="source" position={Position.Right} style={{ background: "#9B59B6" }} />

      {/* Header */}
      <div
        style={{
          padding: "10px 12px",
          background: "#9B59B610",
          borderBottom: "1px solid #9B59B622",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 22 }}>🧑</span>
        <h4
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 600,
            color: "#E8E8E8",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {data.name || "Unnamed"}
        </h4>
      </div>

      {/* Body */}
      <div style={{ padding: "8px 12px" }}>
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
        {data.motivation && (
          <p
            style={{
              margin: 0,
              fontSize: 10,
              color: "#6BCB77",
              fontStyle: "italic",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            🎯 {data.motivation}
          </p>
        )}
      </div>
    </div>
  );
}

export const CharacterNode = memo(CharacterNodeComponent);
