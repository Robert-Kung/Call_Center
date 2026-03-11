/**
 * AudioWorkletProcessor — 麥克風音訊採集
 *
 * 對齊官方做法 (gemini-live-ephemeral-tokens-websocket/audio-processors/capture.worklet.js):
 * - 累積 float32 樣本至 bufferSize 後送出
 * - 不做降採樣、不做 int16 轉換（主執行緒處理）
 * - 當 AudioContext 建在 16kHz 時，瀏覽器硬體自動降採樣，worklet 收到的就是 16kHz
 *
 * 官方 bufferSize = 4096（256ms @16kHz）
 *
 * processorOptions:
 *   bufferSize {number}  每次送出的樣本數（預設 4096 = 256ms @16kHz，與官方一致）
 */
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = options.processorOptions || {};
    this.bufferSize = opts.bufferSize || 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const inputChannel = input[0];
    if (!inputChannel) return true;

    for (let i = 0; i < inputChannel.length; i++) {
      this.buffer[this.bufferIndex++] = inputChannel[i];

      if (this.bufferIndex >= this.bufferSize) {
        // 送出累積的 float32 樣本
        this.port.postMessage({
          type: 'audio',
          data: this.buffer.slice()
        });
        this.bufferIndex = 0;
      }
    }

    return true;
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);
