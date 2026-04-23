import type { StoryState } from "../hooks/useStoryState";

const IMAGE_MODEL = "gemini-3.1-flash-image-preview";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

type StoryActions = Pick<StoryState, "updateScene" | "addTrace">;

/**
 * Storyboard Agent — generates images via Gemini REST API (gemini-3.1-flash-image-preview)
 * and attaches them to scene nodes asynchronously.
 */
export async function generateStoryboard(
  sceneId: string,
  sceneTitle: string,
  prompt: string,
  apiKey: string,
  actions: StoryActions,
): Promise<void> {
  const traceId = `trace-sb-${Date.now()}`;

  actions.addTrace({
    id: traceId,
    type: "storyboard_queued",
    message: `🖼️ Storyboard Agent: generating "${sceneTitle}"...`,
    timestamp: Date.now(),
  });

  // Mark the scene as loading
  actions.updateScene(sceneId, { imageLoading: true });

  try {
    const url = `${API_BASE}/${IMAGE_MODEL}:generateContent`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Generate a cinematic storyboard panel for this scene: ${prompt}. Style: film storyboard, dramatic lighting, widescreen composition, pencil sketch with color wash.`,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          temperature: 0.8,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Image API ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    const candidates = data?.candidates ?? [];
    let imageUrl: string | undefined;

    // Extract inline image data from response
    for (const candidate of candidates) {
      const parts = candidate?.content?.parts ?? [];
      for (const part of parts) {
        if (part.inlineData?.data && part.inlineData?.mimeType) {
          imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          break;
        }
      }
      if (imageUrl) break;
    }

    if (imageUrl) {
      actions.updateScene(sceneId, { imageUrl, imageLoading: false });
      actions.addTrace({
        id: `trace-sb-done-${Date.now()}`,
        type: "storyboard_complete",
        message: `✅ Storyboard Agent: "${sceneTitle}" complete`,
        timestamp: Date.now(),
      });
    } else {
      actions.updateScene(sceneId, { imageLoading: false });
      actions.addTrace({
        id: `trace-sb-noimg-${Date.now()}`,
        type: "storyboard_queued",
        message: `⚠️ Storyboard Agent: no image returned for "${sceneTitle}"`,
        timestamp: Date.now(),
      });
    }
  } catch (err) {
    actions.updateScene(sceneId, { imageLoading: false });
    actions.addTrace({
      id: `trace-sb-err-${Date.now()}`,
      type: "error",
      message: `❌ Storyboard Agent: ${err instanceof Error ? err.message : "unknown error"}`,
      timestamp: Date.now(),
    });
  }
}
