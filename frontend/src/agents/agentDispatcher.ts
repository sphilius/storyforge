import type { StoryState } from "../hooks/useStoryState";
import { handleCharacterIntroduce } from "./characterAgent";
import { handleSceneUpdate } from "./sceneAgent";
import { runSentinelCheck } from "./sentinelAgent";

type DispatchContext = {
  apiKey: string;
  addScene: StoryState["addScene"];
  updateScene: StoryState["updateScene"];
  addCharacter: StoryState["addCharacter"];
  addTrace: StoryState["addTrace"];
  scenes: StoryState["scenes"];
  setNavigation?: (nav: { action: string; target?: string }) => void;
};

/**
 * Central dispatcher — routes tool calls from the Live API to the correct sub-agent.
 * Each sub-agent handles its domain, logs to Trace View, and returns a result
 * for the tool_response back to the Live API.
 */
export function dispatchToolCall(
  name: string,
  args: Record<string, unknown>,
  context: DispatchContext,
): Record<string, string> {
  switch (name) {
    case "update_scene": {
      const result = handleSceneUpdate(
        {
          title: typeof args.title === "string" ? args.title : undefined,
          description: typeof args.description === "string" ? args.description : undefined,
          mood: typeof args.mood === "string" ? args.mood : undefined,
          directorNotes: typeof args.directorNotes === "string" ? args.directorNotes : undefined,
        },
        {
          apiKey: context.apiKey,
          addScene: context.addScene,
          updateScene: context.updateScene,
          addTrace: context.addTrace,
        },
      );

      // Run Sentinel check asynchronously after scene creation
      setTimeout(() => {
        runSentinelCheck(
          {
            title: typeof args.title === "string" ? args.title : "Untitled",
            description: typeof args.description === "string" ? args.description : "",
            mood: typeof args.mood === "string" ? args.mood : "dramatic",
          },
          { scenes: context.scenes, addTrace: context.addTrace },
        );
      }, 100);

      return result;
    }

    case "introduce_character": {
      return handleCharacterIntroduce(
        {
          name: typeof args.name === "string" ? args.name : undefined,
          description: typeof args.description === "string" ? args.description : undefined,
          motivation: typeof args.motivation === "string" ? args.motivation : undefined,
        },
        {
          addCharacter: context.addCharacter,
          addTrace: context.addTrace,
        },
      );
    }

    case "generate_storyboard": {
      // Direct storyboard requests without a parent scene
      context.addTrace({
        id: `trace-sb-direct-${Date.now()}`,
        type: "storyboard_queued",
        message: `🖼️ Storyboard Agent: standalone request for "${typeof args.scene_title === "string" ? args.scene_title : "current scene"}"`,
        timestamp: Date.now(),
      });
      return { status: "storyboard_queued" };
    }

    case "navigate_canvas": {
      const action = typeof args.action === "string" ? args.action : "fit_view";
      const target = typeof args.target === "string" ? args.target : undefined;
      context.addTrace({
        id: `trace-nav-${Date.now()}`,
        type: "tool_call",
        message: `🧭 Navigator: ${action}${target ? ` → "${target}"` : ""}`,
        timestamp: Date.now(),
      });
      // Store navigation intent in zustand for the canvas component to execute
      if (context.setNavigation) {
        context.setNavigation({ action, target });
      }
      return { status: "navigation_executed", action };
    }

    default:
      context.addTrace({
        id: `trace-unknown-${Date.now()}`,
        type: "error",
        message: `⚠️ Dispatcher: unknown tool "${name}"`,
        timestamp: Date.now(),
      });
      return { status: "unsupported_tool" };
  }
}
