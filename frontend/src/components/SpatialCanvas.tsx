import { useMemo } from "react";
import ReactFlow, { Background, Controls, MiniMap, BackgroundVariant } from "reactflow";
import type { Node, Edge } from "reactflow";
import "reactflow/dist/style.css";
import type { Scene, Character } from "../hooks/useStoryState";
import { SceneNode } from "./nodes/SceneNode";
import { CharacterNode } from "./nodes/CharacterNode";

const nodeTypes = {
  scene: SceneNode,
  character: CharacterNode,
};

function hashCode(str: string): number {
  return str.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
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
      position: {
        x: 200 + index * 350,
        y: 150 + (hashCode(scene.title) % 200),
      },
      data: {
        title: scene.title,
        mood: scene.mood,
        description: scene.description,
        directorNotes: scene.directorNotes,
        imageUrl: scene.imageUrl,
        imageLoading: scene.imageLoading,
        imageError: scene.imageError,
      },
    }));

    const charNodes: Node[] = characters.map((char) => {
      // Find parent scene that references this character
      const parentSceneIdx = scenes.findIndex((s) =>
        s.characters.includes(char.id) || s.characters.includes(char.name),
      );
      const parentX = parentSceneIdx >= 0 ? 200 + parentSceneIdx * 350 : 200;
      const parentY = parentSceneIdx >= 0 ? 150 + (hashCode(scenes[parentSceneIdx].title) % 200) : 350;

      return {
        id: char.id,
        type: "character",
        position: {
          x: parentX + 50,
          y: parentY + 220,
        },
        data: {
          name: char.name,
          description: char.description,
          motivation: char.motivation,
        },
      };
    });

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
      <Background variant={BackgroundVariant.Dots} color="#1a1a1a" gap={20} />
      <Controls
        style={{
          background: "#1A1A2E",
          borderColor: "#2B2F3A",
          borderRadius: 8,
        }}
      />
      <MiniMap
        nodeColor="#D4A017"
        maskColor="rgba(0,0,0,0.7)"
        style={{ background: "#1A1A2E" }}
      />
    </ReactFlow>
  );
}
