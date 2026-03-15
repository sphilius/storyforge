import type { StoryState } from "../hooks/useStoryState";

type CharacterArgs = {
  name?: string;
  description?: string;
  motivation?: string;
};

type CharacterContext = {
  addCharacter: StoryState["addCharacter"];
  addTrace: StoryState["addTrace"];
};

/**
 * Character Agent — creates character nodes and logs to trace.
 */
export function handleCharacterIntroduce(
  args: CharacterArgs,
  context: CharacterContext,
): Record<string, string> {
  const name = args.name ?? "Unnamed Character";

  context.addCharacter({
    name,
    description: args.description ?? "",
    motivation: args.motivation ?? "",
  });

  context.addTrace({
    id: `trace-char-${Date.now()}`,
    type: "character_introduced",
    message: `🧑 Character Agent: "${name}" locked in`,
    timestamp: Date.now(),
  });

  return { status: "character_introduced" };
}
