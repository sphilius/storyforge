import type { Scene, TraceEvent } from "../hooks/useStoryState";

export interface GeneratedImage {
  dataUrl: string;
  mimeType: string;
  source: "gemini" | "fallback";
}

type GeminiInlineData = {
  mime_type?: string;
  data?: string;
};

type GeminiPart = {
  inline_data?: GeminiInlineData;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
};

const GEMINI_IMAGE_MODEL = "gemini-2.0-flash-exp";
const GEMINI_IMAGE_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function escapeSvg(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildFallbackSvg(title: string): GeneratedImage {
  const safeTitle = escapeSvg(title || "Storyboard");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><defs><linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="#1A1A2E"/><stop offset="100%" stop-color="#0D0D0D"/></linearGradient></defs><rect width="1280" height="720" fill="url(#bg)"/><rect x="64" y="64" width="1152" height="592" fill="none" stroke="#D4A017" stroke-width="4"/><text x="640" y="360" fill="#E8E8E8" text-anchor="middle" font-family="Arial, sans-serif" font-size="48">${safeTitle}</text></svg>`;
  const data = btoa(unescape(encodeURIComponent(svg)));

  return {
    dataUrl: `data:image/svg+xml;base64,${data}`,
    mimeType: "image/svg+xml",
    source: "fallback",
  };
}

function parseImagePart(payload: GeminiResponse): GeneratedImage | null {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const mimeType = part.inline_data?.mime_type;
    const data = part.inline_data?.data;
    if (mimeType?.startsWith("image/") && data) {
      return {
        dataUrl: `data:${mimeType};base64,${data}`,
        mimeType,
        source: "gemini",
      };
    }
  }

  return null;
}

export function buildStoryboardPrompt(scene: {
  title: string;
  description: string;
  mood: string;
  directorNotes?: string;
}): string {
  const prompt = `Title: ${scene.title}. Cinematic storyboard panel. ${scene.description}. Mood: ${scene.mood}. ${scene.directorNotes || ""}. Professional film composition, dramatic lighting, widescreen aspect ratio, concept art style.`
    .replace(/\s+/g, " ")
    .trim();

  return prompt.slice(0, 500);
}

export async function generateStoryboardImage(
  apiKey: string,
  prompt: string,
): Promise<GeneratedImage> {
  const runRequest = async (): Promise<GeneratedImage | null> => {
    const response = await fetch(`${GEMINI_IMAGE_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini image request failed with HTTP ${response.status}`);
    }

    const payload = (await response.json()) as GeminiResponse;
    return parseImagePart(payload);
  };

  try {
    const image = await runRequest();
    if (image) {
      return image;
    }
  } catch {
    await sleep(2000);
    try {
      const retryImage = await runRequest();
      if (retryImage) {
        return retryImage;
      }
    } catch {
      // fall through to fallback SVG
    }

    return buildFallbackSvg(prompt.replace(/^Title:\s*/i, "").split(".")[0] || "Storyboard");
  }

  return buildFallbackSvg(prompt.replace(/^Title:\s*/i, "").split(".")[0] || "Storyboard");
}

export async function generateAndAttachStoryboard(
  apiKey: string,
  sceneId: string,
  scene: Scene,
  updateScene: (id: string, updates: Partial<Scene>) => void,
  addTrace: (event: TraceEvent) => void,
): Promise<void> {
  addTrace({
    type: "storyboard_queued",
    message: `Queued storyboard image generation for ${scene.title}`,
    sceneId,
    timestamp: new Date().toISOString(),
  });
  updateScene(sceneId, { imageLoading: true, imageError: false });

  try {
    const prompt = buildStoryboardPrompt(scene);
    const image = await generateStoryboardImage(apiKey, prompt);

    updateScene(sceneId, {
      imageUrl: image.dataUrl,
      imageLoading: false,
      imageError: false,
    });

    addTrace({
      type: "storyboard_complete",
      message: `Storyboard generated for ${scene.title} via ${image.source}`,
      sceneId,
      timestamp: new Date().toISOString(),
    });
  } catch {
    updateScene(sceneId, { imageLoading: false, imageError: true });
    addTrace({
      type: "error",
      message: `Storyboard generation failed for ${scene.title}`,
      sceneId,
      timestamp: new Date().toISOString(),
    });
  }
}
