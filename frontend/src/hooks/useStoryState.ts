import { create } from "zustand";

export type TraceEvent = {
  type: string;
  message: string;
  sceneId?: string;
  timestamp: string;
};

export type Scene = {
  id: string;
  title: string;
  description: string;
  mood: string;
  directorNotes?: string;
  imageUrl?: string;
  imageLoading?: boolean;
  imageError?: boolean;
};

type StoryState = {
  scenes: Scene[];
  trace: TraceEvent[];
  upsertScene: (scene: Scene) => void;
  updateScene: (id: string, updates: Partial<Scene>) => void;
  addTrace: (event: TraceEvent) => void;
};

export const useStoryState = create<StoryState>((set) => ({
  scenes: [],
  trace: [],
  upsertScene: (scene) =>
    set((state) => {
      const existingIndex = state.scenes.findIndex((item) => item.id === scene.id);
      if (existingIndex === -1) {
        return { scenes: [...state.scenes, scene] };
      }

      const nextScenes = [...state.scenes];
      nextScenes[existingIndex] = { ...nextScenes[existingIndex], ...scene };
      return { scenes: nextScenes };
    }),
  updateScene: (id, updates) =>
    set((state) => ({
      scenes: state.scenes.map((scene) =>
        scene.id === id
          ? {
              ...scene,
              ...updates,
            }
          : scene,
      ),
    })),
  addTrace: (event) => set((state) => ({ trace: [...state.trace, event] })),
}));
