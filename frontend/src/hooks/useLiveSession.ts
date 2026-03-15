import { useCallback, useRef, useState } from "react";
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
          text: "You are Director Mode — an elite AI cinematographer and creative partner. You help filmmakers direct stories through voice conversation. You are sharp, witty, cinematically literate, and creatively challenging — never servile. When the director gives a cue, narrate what happens in 2-4 evocative sentences. Use the update_scene tool when scenes change. Use introduce_character when new characters appear. Use generate_storyboard to create visual panels. Match the director's energy. Use conversational filler naturally. Never break character.",
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

  const addScene = useStoryState((state) => state.addScene);
  const addCharacter = useStoryState((state) => state.addCharacter);
  const addTrace = useStoryState((state) => state.addTrace);

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

  const sendPayload = useCallback((payload: unknown) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  }, []);

  const handleToolCall = useCallback(
    (functionCall: FunctionCall) => {
      const args = parseArgs(functionCall.args);
      let result: Record<string, string>;

      switch (functionCall.name) {
        case "update_scene":
          addScene({
            title: typeof args.title === "string" ? args.title : "Untitled Scene",
            description:
              typeof args.description === "string" ? args.description : "",
            mood: typeof args.mood === "string" ? args.mood : "dramatic",
            directorNotes:
              typeof args.directorNotes === "string" ? args.directorNotes : "",
          });
          result = { status: "scene_updated" };
          break;
        case "introduce_character":
          addCharacter({
            name: typeof args.name === "string" ? args.name : "Unnamed Character",
            description:
              typeof args.description === "string" ? args.description : "",
            motivation:
              typeof args.motivation === "string" ? args.motivation : "",
          });
          result = { status: "character_introduced" };
          break;
        case "generate_storyboard":
          addTrace({
            id: `trace-${Date.now()}`,
            type: "storyboard_queued",
            message: `Storyboard queued for ${typeof args.scene_title === "string" ? args.scene_title : "current scene"}`,
            timestamp: Date.now(),
          });
          result = { status: "storyboard_queued" };
          break;
        default:
          result = { status: "unsupported_tool" };
      }

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
    [addCharacter, addScene, addTrace, emitToolCall, sendPayload],
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
        },
      }

      const turnComplete = sc?.turnComplete ?? sc?.turn_complete;
      if (turnComplete) {
        console.log("[LiveSession] Turn complete");
        emitTurnComplete();
      }
    },
    [emitAudio, emitTurnComplete, handleToolCall],
  );

  const connect = useCallback(
    (apiKey: string) => {
      if (!apiKey || status === "connecting" || status === "connected") {
        return;
      }

      setStatus("connecting");
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

  return {
    connect,
    disconnect,
    sendAudio,
    sendText,
    status,
    onAudio,
    onToolCall,
    onTurnComplete,
  };
};
