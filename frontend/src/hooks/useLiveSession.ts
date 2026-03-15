import { useCallback, useRef, useState } from "react";
import { dispatchToolCall } from "../agents/agentDispatcher";
import { useStoryState } from "./useStoryState";

type SessionStatus = "idle" | "connecting" | "connected" | "error";
type ToolCallCallback = (name: string, args: unknown, result: unknown) => void;

const MODEL_NAME = "models/gemini-2.5-flash-native-audio-preview-12-2025";
const WS_ENDPOINT =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

const buildSetupMessage = () => ({
  setup: {
    model: MODEL_NAME,
    generation_config: {
      response_modalities: ["AUDIO"],
      temperature: 0.5,
      top_p: 0.9,
      top_k: 20,
      speech_config: {
        voice_config: {
          prebuilt_voice_config: { voice_name: "Kore" },
        },
      },
    },
    system_instruction: {
      parts: [
        {
          text: `You are the Director Agent — crew chief of Director Mode, a voice-operated AI film production crew.

PERSONALITY MATRIX:
- Sharp: Quick-witted, uses film terminology naturally. Think a veteran AD who's seen everything.
- Confident: Self-assured but never arrogant. You know your craft.
- Terse: You respect the director's time. Brevity is professionalism.
- Opinionated: You have taste. When something works, you say so. When it doesn't, you push back — briefly.
- Adaptable: Match the director's energy. If they're rapid-firing ideas, keep up. If they're thinking, give them space.

RULES:
1. ALL voice responses under 8 seconds. You are crew, not talent.
2. Acknowledge and execute: "Copy that — Tokyo alley, midnight. Rendering now."
3. Creative pushback ONLY when it matters: "That mood shift might jar the audience — keep it or adjust?"
4. ALWAYS fire tools. Every scene → update_scene. Every character → introduce_character. Every visual → generate_storyboard.
5. Never narrate. Never monologue. The CANVAS is the output, not your voice.
6. One clarifying question max: "Interior or exterior?" "What era?" "Tense or calm?"
7. When dispatching multiple tasks: "Setting the scene, queuing the board, locking the character — stand by."
8. Sound like you belong on set. "Let's get this coverage." "That's a wrap on scene two." "Moving on."

PROACTIVE BEHAVIOR:
- When the director says "next", "continue", "keep going", or "what happens next" — you MUST generate the next story beat yourself. Create the next scene with update_scene, introduce any new characters, and generate a storyboard. Don't ask what happens next — YOU decide and execute.
- After creating a scene, if the story has natural momentum, suggest what comes next: "Scene two's locked. Want me to push into the confrontation, or hold here?"
- When the director gives a vague cue like "make it darker" or "add tension", interpret it cinematically and fire tools immediately.

CANVAS NAVIGATION:
- When the director says "scroll right", "move left", "zoom in", "zoom out", "show me everything", "focus on the last scene", or similar navigation commands — use the navigate_canvas tool.
- "Show me everything" or "fit all" → action: fit_view
- "Zoom in" / "Zoom out" → action: zoom_in or zoom_out
- "Scroll left/right/up/down" → action: pan with appropriate direction
- "Go to scene X" or "focus on the detective" → action: focus_node with the node title

KNOWLEDGE:
- Cinematography: shot types, camera angles, lighting, composition
- Narrative structure: three-act, five-act, hero's journey, scene-sequel
- Genre conventions: noir, thriller, romance, sci-fi, horror, drama
- Production terminology: coverage, blocking, storyboard, animatic, beat sheet
- Story quality: pacing, continuity, escalation, character motivation`,
        },
      ],
    },
    tools: [
      { google_search: {} },
      {
        function_declarations: [
          {
            name: "update_scene",
            description: "Update current scene metadata when setting, mood, or action changes.",
            parameters: {
              type: "OBJECT",
              properties: {
                title: { type: "STRING" },
                description: { type: "STRING" },
                mood: { type: "STRING", enum: ["tense","calm","joyful","mysterious","dramatic","melancholic","suspenseful","romantic"] },
                directorNotes: { type: "STRING" },
              },
            },
          },
          {
            name: "introduce_character",
            description: "Introduce or update a character in the story.",
            parameters: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                description: { type: "STRING" },
                motivation: { type: "STRING" },
              },
            },
          },
          {
            name: "generate_storyboard",
            description: "Generate a storyboard visual panel for the described scene.",
            parameters: {
              type: "OBJECT",
              properties: {
                scene_title: { type: "STRING" },
                prompt: { type: "STRING" },
              },
            },
          },
          {
            name: "navigate_canvas",
            description: "Navigate the spatial canvas. Use when the director asks to scroll, pan, zoom, fit view, or focus on a specific scene or character node.",
            parameters: {
              type: "OBJECT",
              properties: {
                action: { type: "STRING", enum: ["pan_left","pan_right","pan_up","pan_down","zoom_in","zoom_out","fit_view","focus_node"] },
                target: { type: "STRING", description: "For focus_node: the name/title of the scene or character to focus on" },
              },
            },
          },
        ],
      },
    ],
  },
});

type FunctionCall = {
  id?: string;
  name: string;
  args?: unknown;
};

const parseArgs = (args: unknown): Record<string, unknown> => {
  if (typeof args === "string") {
    try {
      return JSON.parse(args) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  return (args ?? {}) as Record<string, unknown>;
};

export const useLiveSession = () => {
  const [status, setStatus] = useState<SessionStatus>("idle");
  const socketRef = useRef<WebSocket | null>(null);
  const audioCallbacks = useRef<Array<(base64: string) => void>>([]);
  const toolCallbacks = useRef<ToolCallCallback[]>([]);
  const turnCompleteCallbacks = useRef<Array<() => void>>([]);
  const interruptCallbacks = useRef<Array<() => void>>([]);

  const addScene = useStoryState((state) => state.addScene);
  const updateScene = useStoryState((state) => state.updateScene);
  const addCharacter = useStoryState((state) => state.addCharacter);
  const addTrace = useStoryState((state) => state.addTrace);
  const setNavigation = useStoryState((state) => state.setNavigation);
  const scenes = useStoryState((state) => state.scenes);
  const apiKeyRef = useRef<string>("");

  const emitAudio = useCallback((base64: string) => {
    audioCallbacks.current.forEach((callback) => callback(base64));
  }, []);

  const emitToolCall = useCallback(
    (name: string, args: unknown, result: unknown) => {
      toolCallbacks.current.forEach((callback) => callback(name, args, result));
    },
    [],
  );

  const emitTurnComplete = useCallback(() => {
    turnCompleteCallbacks.current.forEach((callback) => callback());
  }, []);

  const emitInterrupt = useCallback(() => {
    interruptCallbacks.current.forEach((callback) => callback());
  }, []);

  const sendPayload = useCallback((payload: unknown) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  }, []);

  const handleToolCall = useCallback(
    (functionCall: FunctionCall) => {
      const args = parseArgs(functionCall.args);

      // Dispatch to the multi-agent swarm
      const result = dispatchToolCall(functionCall.name, args, {
        apiKey: apiKeyRef.current,
        addScene,
        updateScene,
        addCharacter,
        addTrace,
        scenes,
        setNavigation,
      });

      emitToolCall(functionCall.name, args, result);

      sendPayload({
        tool_response: {
          function_responses: [
            {
              id: functionCall.id,
              name: functionCall.name,
              response: result,
            },
          ],
        },
      });
    },
    [addCharacter, addScene, updateScene, addTrace, setNavigation, scenes, emitToolCall, sendPayload],
  );

  const processMessage = useCallback(
    (rawData: string) => {
      const message = JSON.parse(rawData) as Record<string, any>;
      console.log("[LiveSession] Message keys:", Object.keys(message));

      const sc = message?.serverContent ?? message?.server_content;
      const parts = sc?.modelTurn?.parts ?? sc?.model_turn?.parts;
      if (Array.isArray(parts)) {
        parts.forEach((part: Record<string, any>) => {
          const inlineData = part.inlineData ?? part.inline_data;
          if (inlineData?.data) {
            console.log("[LiveSession] Audio chunk, size:", String(inlineData.data).length);
            emitAudio(String(inlineData.data));
          }
        });
      }

      const toolCallContainer = message?.toolCall ?? message?.tool_call;
      const functionCalls: FunctionCall[] =
        toolCallContainer?.functionCalls ?? toolCallContainer?.function_calls ?? [];
      if (Array.isArray(functionCalls)) {
        functionCalls.forEach((fn) => {
          console.log("[LiveSession] Tool call:", fn.name);
          handleToolCall(fn);
        });
      }

      const turnComplete = sc?.turnComplete ?? sc?.turn_complete;
      if (turnComplete) {
        console.log("[LiveSession] Turn complete");
        emitTurnComplete();
      }

      // Detect server-side interruption (barge-in acknowledged by server)
      const interrupted = sc?.interrupted;
      if (interrupted) {
        console.log("[LiveSession] Server acknowledged barge-in");
        emitInterrupt();
      }
    },
    [emitAudio, emitInterrupt, emitTurnComplete, handleToolCall],
  );

  const connect = useCallback(
    (apiKey: string) => {
      if (!apiKey || status === "connecting" || status === "connected") {
        return;
      }

      setStatus("connecting");
      apiKeyRef.current = apiKey;
      const socket = new WebSocket(`${WS_ENDPOINT}?key=${encodeURIComponent(apiKey)}`);
      socketRef.current = socket;

      socket.onopen = () => {
        const setup = buildSetupMessage();
        console.log("[LiveSession] WebSocket opened. Sending setup for model:", setup.setup.model);
        socket.send(JSON.stringify(setup));
        setStatus("connected");
        console.log("[LiveSession] Setup sent. Waiting for server response...");
      };

      socket.onmessage = async (event) => {
  let rawData;
  if (event.data instanceof Blob) {
    rawData = await event.data.text();
  } else {
    rawData = String(event.data);
  }
  try {
    console.log("[LiveSession] Message received");
    processMessage(rawData);
  } catch (err) {
    console.error("[LiveSession] Failed to process:", err);
  }
};

      socket.onerror = (event) => {
        console.error("[LiveSession] WebSocket error:", event);
        setStatus("error");
      };

      socket.onclose = (event) => {
        console.log("[LiveSession] WebSocket closed. Code:", event.code, "Reason:", event.reason, "Clean:", event.wasClean);
        socketRef.current = null;
        setStatus((current) => (current === "error" ? "error" : "idle"));
      };
    },
    [processMessage, status],
  );

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setStatus("idle");
  }, []);

  const sendAudio = useCallback(
    (base64: string) => {
      sendPayload({
        realtime_input: {
          media_chunks: [
            {
              mime_type: "audio/pcm;rate=16000",
              data: base64,
            },
          ],
        },
      });
    },
    [sendPayload],
  );

  const sendText = useCallback(
    (text: string) => {
      sendPayload({
        client_content: {
          turns: [
            {
              role: "user",
              parts: [{ text }],
            },
          ],
          turn_complete: true,
        },
      });
    },
    [sendPayload],
  );

  const onAudio = useCallback((callback: (base64: string) => void) => {
    audioCallbacks.current.push(callback);
  }, []);

  const onToolCall = useCallback((callback: ToolCallCallback) => {
    toolCallbacks.current.push(callback);
  }, []);

  const onTurnComplete = useCallback((callback: () => void) => {
    turnCompleteCallbacks.current.push(callback);
  }, []);

  const onInterrupt = useCallback((callback: () => void) => {
    interruptCallbacks.current.push(callback);
  }, []);

  return {
    connect,
    disconnect,
    sendAudio,
    sendText,
    status,
    onAudio,
    onToolCall,
    onTurnComplete,
    onInterrupt,
  };
};
