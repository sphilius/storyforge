import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { runSentinelCheck } from "./sentinelAgent.ts";
import type { Scene, StoryState } from "../hooks/useStoryState";

// Mock trace function
const mockAddTrace = () => {};

describe("Sentinel Agent - Duplicate Intent Checks", () => {
  test("should not warn if title is unique", () => {
    const existingScenes = [
      { id: "1", title: "The Beginning", description: "A very long description indeed for the start", mood: "calm", characters: [], timestamp: 0, directorNotes: "" } as Scene,
    ];

    const newScene = {
      title: "The Journey",
      description: "Another adequately long description to avoid vague beat warning",
      mood: "tense",
    };

    const context = {
      scenes: existingScenes,
      addTrace: mockAddTrace as StoryState["addTrace"],
    };

    const warnings = runSentinelCheck(newScene, context);

    const duplicateWarnings = warnings.filter(w => w.type === "duplicate_intent");
    assert.equal(duplicateWarnings.length, 0);
  });

  test("should warn if exact duplicate title exists", () => {
    const existingScenes = [
      { id: "1", title: "The Encounter", description: "A very long description indeed for the start", mood: "calm", characters: [], timestamp: 0, directorNotes: "" } as Scene,
    ];

    const newScene = {
      title: "The Encounter",
      description: "Another adequately long description to avoid vague beat warning",
      mood: "tense",
    };

    const context = {
      scenes: existingScenes,
      addTrace: mockAddTrace as StoryState["addTrace"],
    };

    const warnings = runSentinelCheck(newScene, context);

    const duplicateWarnings = warnings.filter(w => w.type === "duplicate_intent");
    assert.equal(duplicateWarnings.length, 1);
    assert.equal(duplicateWarnings[0].message, 'Duplicate scene title: "The Encounter" already exists');
  });

  test("should warn if duplicate title exists with different casing", () => {
    const existingScenes = [
      { id: "1", title: "The Encounter", description: "A very long description indeed for the start", mood: "calm", characters: [], timestamp: 0, directorNotes: "" } as Scene,
    ];

    const newScene = {
      title: "tHe EnCoUnTeR",
      description: "Another adequately long description to avoid vague beat warning",
      mood: "tense",
    };

    const context = {
      scenes: existingScenes,
      addTrace: mockAddTrace as StoryState["addTrace"],
    };

    const warnings = runSentinelCheck(newScene, context);

    const duplicateWarnings = warnings.filter(w => w.type === "duplicate_intent");
    assert.equal(duplicateWarnings.length, 1);
    assert.equal(duplicateWarnings[0].message, 'Duplicate scene title: "tHe EnCoUnTeR" already exists');
  });

  test("should accumulate multiple warnings including duplicate intent", () => {
    const existingScenes = [
      { id: "1", title: "The Encounter", description: "A very long description indeed for the start", mood: "calm", characters: [], timestamp: 0, directorNotes: "" } as Scene,
    ];

    // Title is duplicate AND description is short (< 15 chars) => 2 warnings minimum
    const newScene = {
      title: "The Encounter",
      description: "Too short",
      mood: "tense",
    };

    const context = {
      scenes: existingScenes,
      addTrace: mockAddTrace as unknown as StoryState["addTrace"],
    };

    const warnings = runSentinelCheck(newScene, context);

    const duplicateWarnings = warnings.filter(w => w.type === "duplicate_intent");
    const vagueWarnings = warnings.filter(w => w.type === "vague_beat");

    assert.equal(duplicateWarnings.length, 1);
    assert.equal(vagueWarnings.length, 1);
  });
});
