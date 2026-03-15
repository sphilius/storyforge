class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._ratio = sampleRate / 16000;
    this._index = 0;
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const float32 = input[0];
    const downsampled = [];
    for (let i = 0; i < float32.length; i++) {
      this._index++;
      if (this._index >= this._ratio) {
        this._index -= this._ratio;
        const s = Math.max(-1, Math.min(1, float32[i]));
        downsampled.push(s < 0 ? s * 0x8000 : s * 0x7FFF);
      }
    }
    if (downsampled.length > 0) {
      const pcm = new Int16Array(downsampled);
      this.port.postMessage(pcm.buffer, [pcm.buffer]);
    }
    return true;
  }
}
registerProcessor("audio-capture-processor", AudioCaptureProcessor);
