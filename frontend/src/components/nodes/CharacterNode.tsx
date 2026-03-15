import { memo } from "react";
import { Handle, Position } from "reactflow";
import type { NodeProps } from "reactflow";

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
        border: "1px solid #7C4DFF",
        borderRadius: 10,
        padding: 10,
        width: 200,
        color: "#E8E8E8",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: "#7C4DFF" }} />
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{data.name}</div>
      <p style={{ fontSize: 11, color: "#AAA", margin: "0 0 4px", lineHeight: 1.3 }}>
        {data.description}
      </p>
      {data.motivation ? (
        <p style={{ fontSize: 10, color: "#7C4DFF", margin: 0, fontStyle: "italic" }}>
          {data.motivation}
        </p>
      ) : null}
      <Handle type="source" position={Position.Right} style={{ background: "#7C4DFF" }} />
    </div>
  );
}

export const CharacterNode = memo(CharacterNodeComponent);
