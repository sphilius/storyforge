import { useCallback, useRef } from "react";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToInt16(b64: string): Int16Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

export function useAudioPipeline() {
  const captureCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const nextStartRef = useRef(0);
  const turnSeqRef = useRef(0);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);

  const startCapture = useCallback(async (onChunk: (b64: string) => void) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const ctx = new AudioContext();
    if (ctx.state === "suspended") await ctx.resume();
    captureCtxRef.current = ctx;

    await ctx.audioWorklet.addModule("/audio-processor.js");
    const source = ctx.createMediaStreamSource(stream);
    const worklet = new AudioWorkletNode(ctx, "audio-capture-processor");
    source.connect(worklet);

    worklet.port.onmessage = (e: MessageEvent) => {
      onChunk(arrayBufferToBase64(e.data as ArrayBuffer));
    };

    console.log("[Audio] Capture started");
  }, []);

  const stopCapture = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (captureCtxRef.current) {
      void captureCtxRef.current.close();
      captureCtxRef.current = null;
    }
    console.log("[Audio] Capture stopped");
  }, []);

  const interrupt = useCallback(() => {
    turnSeqRef.current++;
    for (const s of sourcesRef.current) {
      try { s.stop(); } catch {}
    }
    sourcesRef.current = [];
    nextStartRef.current = 0;
    console.log("[Audio] Interrupted, turn:", turnSeqRef.current);
  }, []);

  const schedulePlayback = useCallback((b64: string, turnSeq: number) => {
    if (turnSeq !== turnSeqRef.current) return;

    if (!playCtxRef.current) {
      playCtxRef.current = new AudioContext({ sampleRate: 24000 });
    }
    const ctx = playCtxRef.current;
    if (ctx.state === "suspended") void ctx.resume();

    const int16 = base64ToInt16(b64);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const start = Math.max(now, nextStartRef.current);
    nextStartRef.current = start + buffer.duration;

    sourcesRef.current.push(source);
    source.onended = () => {
      sourcesRef.current = sourcesRef.current.filter((s) => s !== source);
    };
    source.start(start);
  }, []);

  return {
    startCapture,
    stopCapture,
    schedulePlayback,
    interrupt,
    turnSequence: () => turnSeqRef.current,
    isPlaying: () => sourcesRef.current.length > 0,
  };
}
