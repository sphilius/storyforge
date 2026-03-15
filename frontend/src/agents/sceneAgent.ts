import type { StoryState } from "../hooks/useStoryState";
import { generateStoryboard } from "./storyboardAgent";

type SceneArgs = {
  title?: string;
  description?: string;
  mood?: string;
  directorNotes?: string;
};

type SceneContext = {
  apiKey: string;
  addScene: StoryState["addScene"];
  updateScene: StoryState["updateScene"];
  addTrace: StoryState["addTrace"];
};

/**
 * Scene Agent — creates scene nodes and dispatches storyboard generation.
 * Returns tool response for the Live API.
 */
export function handleSceneUpdate(
  args: SceneArgs,
  context: SceneContext,
): Record<string, string> {
  const title = args.title ?? "Untitled Scene";
  const sceneId = `scene-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;

  // Create the scene node
  context.addScene({
    id: sceneId,
    title,
    description: args.description ?? "",
    mood: args.mood ?? "dramatic",
    directorNotes: args.directorNotes ?? "",
    imageLoading: true,
  });

  context.addTrace({
    id: `trace-scene-${Date.now()}`,
    type: "scene_created",
    message: `🎬 Scene Agent: "${title}" created, storyboard queued`,
    timestamp: Date.now(),
  });

  // Fire storyboard generation asynchronously (don't await)
  const storyboardPrompt = `${title}. ${args.description ?? ""} Mood: ${args.mood ?? "dramatic"}`;
  void generateStoryboard(
    sceneId,
    title,
    storyboardPrompt,
    context.apiKey,
    { updateScene: context.updateScene, addTrace: context.addTrace },
  );

  return { status: "scene_updated", scene_id: sceneId };
}
