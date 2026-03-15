import type { Scene, StoryState } from "../hooks/useStoryState";

type SentinelContext = {
  scenes: Scene[];
  addTrace: StoryState["addTrace"];
};

type SentinelWarning = {
  type: "duplicate_intent" | "vague_beat" | "escalation_flat" | "missing_context" | "three_clue_rule";
  message: string;
};

/**
 * Sentinel Agent — runs narrative quality checks after each scene creation.
 * Flags issues like duplicate scenes, vague beats, and flat escalation.
 */
export function runSentinelCheck(
  newScene: { title: string; description: string; mood: string },
  context: SentinelContext,
): SentinelWarning[] {
  const warnings: SentinelWarning[] = [];
  const { scenes } = context;

  // Check duplicate intent — similar titles or descriptions
  for (const existing of scenes) {
    if (existing.title.toLowerCase() === newScene.title.toLowerCase()) {
      warnings.push({
        type: "duplicate_intent",
        message: `Duplicate scene title: "${newScene.title}" already exists`,
      });
    }
  }

  // Check vague beat — description too short or generic
  if (!newScene.description || newScene.description.length < 15) {
    warnings.push({
      type: "vague_beat",
      message: `Scene "${newScene.title}" has a thin description — flesh it out for continuity`,
    });
  }

  // Check escalation flatness — same mood 3+ times in a row
  if (scenes.length >= 2) {
    const lastTwo = scenes.slice(-2);
    if (lastTwo.every((s) => s.mood === newScene.mood)) {
      warnings.push({
        type: "escalation_flat",
        message: `Three scenes in a row with "${newScene.mood}" mood — consider varying the tension`,
      });
    }
  }

  // Three-clue rule: if 4+ scenes and no character connections
  if (scenes.length >= 4) {
    const hasCharRefs = scenes.some((s) => s.characters && s.characters.length > 0);
    if (!hasCharRefs) {
      warnings.push({
        type: "three_clue_rule",
        message: "No characters linked to scenes yet — anchor the story",
      });
    }
  }

  // Log sentinel results
  if (warnings.length > 0) {
    for (const w of warnings) {
      context.addTrace({
        id: `trace-sentinel-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
        type: "sentinel_warning",
        message: `🛡️ Sentinel: ${w.message}`,
        timestamp: Date.now(),
      });
    }
  } else {
    context.addTrace({
      id: `trace-sentinel-ok-${Date.now()}`,
      type: "sentinel_warning",
      message: "🛡️ Sentinel: all checks passed ✓",
      timestamp: Date.now(),
    });
  }

  return warnings;
}
