import { create } from "zustand";

// ─── TYPES ───────────────────────────────────────────────────────
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

// ─── EDGE TYPE ───────────────────────────────────────────────────
// Edges represent narrative connections between nodes on the canvas.
// React Flow uses these to draw animated lines between nodes.
export interface StoryEdge {
  id: string;
  source: string;        // ID of the source node
  target: string;        // ID of the target node
  label?: string;        // Relationship label ("leads to", "appears in", etc.)
  type?: string;         // React Flow edge type (we use "smoothstep" for curved lines)
  animated?: boolean;    // Animated dashed line (true for active connections)
  style?: Record<string, unknown>;
}

// ─── NAVIGATION ──────────────────────────────────────────────────
export interface NavigationCommand {
  action: string;
  target?: string;
}

// ─── STORE INTERFACE ─────────────────────────────────────────────
export interface StoryState {
  title: string;
  genre: string;
  scenes: Scene[];
  characters: Character[];
  edges: StoryEdge[];           // NEW: narrative connections
  currentSceneIndex: number;
  traceEvents: TraceEvent[];
  pendingNavigation: NavigationCommand | null;
  addScene: (scene: Partial<Scene>) => void;
  updateScene: (id: string, updates: Partial<Scene>) => void;
  addCharacter: (character: Partial<Character>) => void;
  addEdge: (edge: StoryEdge) => void;       // NEW: manual edge creation
  removeEdge: (id: string) => void;         // NEW: edge deletion
  addTrace: (event: TraceEvent) => void;
  setNavigation: (nav: NavigationCommand | null) => void;
  getContextSummary: () => string;
}

const SESSION_STORAGE_KEY = "storyforge:story-state";

const generateId = (prefix: string): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getInitialState = () => {
  if (typeof window !== "undefined") {
    const serialized = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (serialized) {
      try {
        const parsed = JSON.parse(serialized);
        // Ensure edges array exists (backward compat with old saved state)
        if (!parsed.edges) parsed.edges = [];
        return parsed;
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
    edges: [],          // NEW
    currentSceneIndex: -1,
    traceEvents: [],
    pendingNavigation: null,
  };
};

const INITIAL_STATE = getInitialState();

// ─── EDGE STYLE PRESETS ──────────────────────────────────────────
// Different visual styles for different relationship types.
// These make the canvas look like a real narrative graph.
const EDGE_STYLES = {
  // Scene → Scene: amber flowing line (story timeline)
  sceneFlow: {
    stroke: "#D4A017",
    strokeWidth: 2,
  },
  // Character → Scene: purple dashed line (appears in)
  characterPresence: {
    stroke: "#9B59B6",
    strokeWidth: 1.5,
    strokeDasharray: "6 3",
  },
  // Manual user connection: cyan solid
  manual: {
    stroke: "#06B6D4",
    strokeWidth: 2,
  },
};

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

    set((state) => {
      const newEdges = [...state.edges];

      // ── AUTO-EDGE: Connect new scene to previous scene ──
      // This creates the story timeline spine on the canvas.
      // Each scene flows into the next with an amber animated line.
      if (state.scenes.length > 0) {
        const prevScene = state.scenes[state.scenes.length - 1];
        newEdges.push({
          id: `edge-${prevScene.id}-${newScene.id}`,
          source: prevScene.id,
          target: newScene.id,
          label: "leads to",
          type: "smoothstep",
          animated: true,
          style: EDGE_STYLES.sceneFlow,
        });
      }

      return {
        scenes: [...state.scenes, newScene],
        edges: newEdges,
        currentSceneIndex: state.scenes.length,
      };
    });
  },

  updateScene: (id, updates) => {
    set((state) => ({
      scenes: state.scenes.map((scene) =>
        scene.id === id ? { ...scene, ...updates, id: scene.id } : scene,
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

    set((state) => {
      const newEdges = [...state.edges];

      // ── AUTO-EDGE: Connect character to the scene they were introduced in ──
      // When a character is first mentioned, they're linked to the current scene
      // with a purple dashed "appears in" line.
      if (state.scenes.length > 0) {
        const currentScene = state.scenes[state.scenes.length - 1];
        newEdges.push({
          id: `edge-${newCharacter.id}-${currentScene.id}`,
          source: newCharacter.id,
          target: currentScene.id,
          label: "appears in",
          type: "smoothstep",
          animated: false,
          style: EDGE_STYLES.characterPresence,
        });
      }

      return {
        characters: [...state.characters, newCharacter],
        edges: newEdges,
      };
    });
  },

  // ── MANUAL EDGE CREATION ──
  // Called when the user drags from one node handle to another.
  addEdge: (edge) => {
    set((state) => ({
      edges: [...state.edges, {
        ...edge,
        style: edge.style ?? EDGE_STYLES.manual,
        type: edge.type ?? "smoothstep",
        animated: edge.animated ?? true,
      }],
    }));
  },

  removeEdge: (id) => {
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== id),
    }));
  },

  addTrace: (event) => {
    set((state) => ({
      traceEvents: [...state.traceEvents, event],
    }));
  },

  setNavigation: (nav) => {
    set({ pendingNavigation: nav });
  },

  getContextSummary: () => {
    const { title, genre, scenes, characters } = get();
    const sceneTitle = scenes.length > 0 ? scenes[scenes.length - 1].title : "No scenes yet";
    return `Story: ${title} (${genre || "genre unspecified"}). Scenes: ${scenes.length}. Characters: ${characters.length}. Current scene: ${sceneTitle}.`;
  },
}));

// ─── PERSIST TO SESSION STORAGE ──────────────────────────────────
if (typeof window !== "undefined") {
  useStoryState.subscribe((state) => {
    try {
      const snapshot = {
        title: state.title,
        genre: state.genre,
        scenes: state.scenes.map((s) => ({
          ...s,
          imageUrl: undefined,
          imageLoading: undefined,
        })),
        characters: state.characters,
        edges: state.edges,    // NEW: persist edges too
        currentSceneIndex: state.currentSceneIndex,
        traceEvents: state.traceEvents.slice(-50),
      };
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Storage full — clear and continue (prevents the QuotaExceededError crash)
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  });
}