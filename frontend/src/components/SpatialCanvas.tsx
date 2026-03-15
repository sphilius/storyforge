import { useMemo } from "react";
import ReactFlow, { Background, Controls, MiniMap } from "reactflow";
import type { Node, Edge } from "reactflow";
import "reactflow/dist/style.css";
import type { Scene, Character } from "../hooks/useStoryState";
import { SceneNode } from "./nodes/SceneNode";
import { CharacterNode } from "./nodes/CharacterNode";

const nodeTypes = {
  scene: SceneNode,
  character: CharacterNode,
};

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

type SpatialCanvasProps = {
  scenes: Scene[];
  characters: Character[];
};

export function SpatialCanvas({ scenes, characters }: SpatialCanvasProps) {
  const nodes = useMemo<Node[]>(() => {
    const sceneNodes: Node[] = scenes.map((scene, index) => ({
      id: scene.id,
      type: "scene",
      position: { x: 200 + index * 350, y: 150 + (hashCode(scene.id) % 200) },
      data: {
        title: scene.title,
        mood: scene.mood,
        description: scene.description,
        imageUrl: scene.imageUrl,
        imageLoading: scene.imageLoading,
      },
    }));

    const charNodes: Node[] = characters.map((char, index) => ({
      id: char.id,
      type: "character",
      position: { x: 100 + index * 250, y: 500 + (hashCode(char.id) % 120) },
      data: {
        name: char.name,
        description: char.description,
        motivation: char.motivation,
      },
    }));

    return [...sceneNodes, ...charNodes];
  }, [scenes, characters]);

  const edges = useMemo<Edge[]>(() => {
    return scenes.slice(1).map((scene, i) => ({
      id: `e-${scenes[i].id}-${scene.id}`,
      source: scenes[i].id,
      target: scene.id,
      type: "smoothstep",
      animated: true,
      style: { stroke: "#D4A017", strokeWidth: 2 },
    }));
  }, [scenes]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      proOptions={{ hideAttribution: true }}
      style={{ background: "#0D0D0D" }}
    >
      <Background color="#1A1A2E" gap={24} />
      <Controls style={{ background: "#1A1A2E", borderColor: "#2B2F3A" }} />
      <MiniMap
        nodeColor="#D4A017"
        maskColor="rgba(0,0,0,0.7)"
        style={{ background: "#1A1A2E" }}
      />
    </ReactFlow>
  );
}
