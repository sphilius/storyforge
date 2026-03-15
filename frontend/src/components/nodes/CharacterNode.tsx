import { memo } from "react";
import { Handle, Position } from "reactflow";
import type { NodeProps } from "reactflow";
import { User } from "lucide-react";

type CharacterNodeData = {
  name: string;
  description: string;
  motivation: string;
};

function CharacterNodeComponent({ data }: NodeProps<CharacterNodeData>) {
  return (
    <div
      style={{
        background: "#1A1A2E",
        border: "1px solid #6C3483",
        borderRadius: 10,
        padding: 10,
        width: 220,
        color: "#E8E8E8",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: "#6C3483" }} />

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <User size={14} color="#6C3483" />
        <span style={{ fontWeight: 700, fontSize: 13 }}>{data.name}</span>
      </div>

      <p
        style={{
          fontSize: 11,
          color: "#AAA",
          margin: "0 0 4px",
          lineHeight: 1.3,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {data.description}
      </p>

      {data.motivation ? (
        <p style={{ fontSize: 10, color: "#6C3483", margin: 0, fontStyle: "italic" }}>
          {data.motivation}
        </p>
      ) : null}

      <Handle type="source" position={Position.Right} style={{ background: "#6C3483" }} />
    </div>
  );
}

export const CharacterNode = memo(CharacterNodeComponent);
