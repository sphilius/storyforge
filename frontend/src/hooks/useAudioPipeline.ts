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

const BARGE_IN_RMS_THRESHOLD = 0.03;

export function useAudioPipeline() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const playContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const turnSequenceRef = useRef(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const bargeInCallbackRef = useRef<(() => void) | null>(null);
  const rafIdRef = useRef(0);

  const interrupt = useCallback(() => {
    turnSequenceRef.current++;
    nextStartTimeRef.current = 0;
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
      } catch {
        // already stopped
      }
    }
    activeSourcesRef.current = [];
  }, []);

  const checkBargeIn = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser || activeSourcesRef.current.length === 0) {
      rafIdRef.current = requestAnimationFrame(checkBargeIn);
      return;
    }
    const data = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    const rms = Math.sqrt(sum / data.length);
    if (rms > BARGE_IN_RMS_THRESHOLD) {
      interrupt();
      bargeInCallbackRef.current?.();
    }
    rafIdRef.current = requestAnimationFrame(checkBargeIn);
  }, [interrupt]);

  const startCapture = useCallback(
    async (onChunk: (b64: string) => void) => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: 48000 });
      if (ctx.state === "suspended") {
        void ctx.resume();
      }
      audioContextRef.current = ctx;

      await ctx.audioWorklet.addModule("/audio-processor.js");
      const source = ctx.createMediaStreamSource(stream);
      const worklet = new AudioWorkletNode(ctx, "audio-capture-processor");
      workletNodeRef.current = worklet;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      source.connect(analyser);
      source.connect(worklet);

      worklet.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
        onChunk(arrayBufferToBase64(e.data));
      };

      rafIdRef.current = requestAnimationFrame(checkBargeIn);
    },
    [checkBargeIn],
  );

  const stopCapture = useCallback(() => {
    cancelAnimationFrame(rafIdRef.current);
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;
    analyserRef.current = null;
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const schedulePlayback = useCallback((b64: string, turnSeq: number) => {
    if (turnSeq !== turnSequenceRef.current) return;

    if (!playContextRef.current) {
      playContextRef.current = new AudioContext({ sampleRate: 24000 });
    }
    const ctx = playContextRef.current;
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
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
    const start = Math.max(now, nextStartTimeRef.current);
    nextStartTimeRef.current = start + buffer.duration;

    activeSourcesRef.current.push(source);
    source.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
    };
    source.start(start);
  }, []);

  const setBargeInCallback = useCallback((cb: () => void) => {
    bargeInCallbackRef.current = cb;
  }, []);

  return {
    startCapture,
    stopCapture,
    schedulePlayback,
    interrupt,
    setBargeInCallback,
    isPlaying: () => activeSourcesRef.current.length > 0,
    turnSequence: () => turnSequenceRef.current,
  };
}
