import { create } from "zustand";

export interface Scene {
  id: string;
  title: string;
  description: string;
  mood: string;
  directorNotes: string;
  imageUrl?: string;
  imageLoading?: boolean;
  characters: string[];
  timestamp: number;
}

export interface Character {
  id: string;
  name: string;
  description: string;
  motivation: string;
}

export interface TraceEvent {
  id: string;
  type:
    | "user_input"
    | "model_responding"
    | "tool_call"
    | "scene_created"
    | "character_introduced"
    | "storyboard_queued"
    | "storyboard_complete"
    | "sentinel_warning"
    | "error";
  message: string;
  timestamp: number;
}

export interface StoryState {
  title: string;
  genre: string;
  scenes: Scene[];
  characters: Character[];
  currentSceneIndex: number;
  traceEvents: TraceEvent[];
  addScene: (scene: Partial<Scene>) => void;
  updateScene: (id: string, updates: Partial<Scene>) => void;
  addCharacter: (character: Partial<Character>) => void;
  addTrace: (event: TraceEvent) => void;
  getContextSummary: () => string;
}

const SESSION_STORAGE_KEY = "storyforge:story-state";

const generateId = (prefix: string): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getInitialState = (): Omit<StoryState, "addScene" | "updateScene" | "addCharacter" | "addTrace" | "getContextSummary"> => {
  if (typeof window !== "undefined") {
    const serialized = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (serialized) {
      try {
        return JSON.parse(serialized) as Omit<StoryState, "addScene" | "updateScene" | "addCharacter" | "addTrace" | "getContextSummary">;
      } catch {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
  }

  return {
    title: "Untitled Story",
    genre: "",
    scenes: [],
    characters: [],
    currentSceneIndex: -1,
    traceEvents: [],
  };
};

const INITIAL_STATE = getInitialState();

export const useStoryState = create<StoryState>()((set, get) => ({
  ...INITIAL_STATE,
  addScene: (scene) => {
    const now = Date.now();
    const newScene: Scene = {
      id: scene.id ?? generateId("scene"),
      title: scene.title ?? "Untitled Scene",
      description: scene.description ?? "",
      mood: scene.mood ?? "dramatic",
      directorNotes: scene.directorNotes ?? "",
      imageUrl: scene.imageUrl,
      imageLoading: scene.imageLoading,
      characters: scene.characters ?? [],
      timestamp: scene.timestamp ?? now,
    };

    set((state) => ({
      scenes: [...state.scenes, newScene],
      currentSceneIndex: state.scenes.length,
    }));
  },
  updateScene: (id, updates) => {
    set((state) => ({
      scenes: state.scenes.map((scene) =>
        scene.id === id
          ? {
              ...scene,
              ...updates,
              id: scene.id,
            }
          : scene,
      ),
    }));
  },
  addCharacter: (character) => {
    const newCharacter: Character = {
      id: character.id ?? generateId("character"),
      name: character.name ?? "Unnamed Character",
      description: character.description ?? "",
      motivation: character.motivation ?? "",
    };

    set((state) => ({
      characters: [...state.characters, newCharacter],
    }));
  },
  addTrace: (event) => {
    set((state) => ({
      traceEvents: [...state.traceEvents, event],
    }));
  },
  getContextSummary: () => {
    const { title, genre, scenes, characters } = get();
    const sceneTitle = scenes.length > 0 ? scenes[scenes.length - 1].title : "No scenes yet";
    return `Story: ${title} (${genre || "genre unspecified"}). Scenes: ${scenes.length}. Characters: ${characters.length}. Current scene: ${sceneTitle}.`;
  },
}));

if (typeof window !== "undefined") {
  useStoryState.subscribe((state) => {
    const snapshot = {
      title: state.title,
      genre: state.genre,
      scenes: state.scenes,
      characters: state.characters,
      currentSceneIndex: state.currentSceneIndex,
      traceEvents: state.traceEvents,
    };
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(snapshot));
  });
}
