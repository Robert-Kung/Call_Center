/**
 * AudioWorkletProcessor — 麥克風音訊採集與可選降採樣
 *
 * 在獨立的 Audio Worklet 執行緒中執行，與主執行緒完全隔離。
 * 每次 process() 接收固定 128 samples，累積至目標大小後透過
 * MessagePort 傳送到主執行緒（零複製 ArrayBuffer transfer）。
 *
 * processorOptions:
 *   targetChunkMs {number}    目標 chunk 時間長度（毫秒），預設 100ms
 *   resampleTo    {number|null}  目標取樣率（null = 不降採，直送原始取樣率）
 *
 * 主執行緒接收格式:
 *   { int16: ArrayBuffer, outputRate: number, maxAmp: number }
 */
class AudioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = options.processorOptions || {};

    // 目標 chunk 時間（毫秒），預設 100ms
    this._targetChunkMs = opts.targetChunkMs || 100;

    // 目標取樣率（null = 不降採）
    this._resampleTo = opts.resampleTo || null;

    // 累積緩衝（Float32 樣本）
    this._buffer = [];

    // AudioWorkletGlobalScope 全域變數 `sampleRate`（來源取樣率）
    this._sourceRate = sampleRate;

    // 每個 chunk 所需的來源樣本數
    this._targetSourceSamples = Math.floor(this._sourceRate * this._targetChunkMs / 1000);
  }

  /**
   * 每次由音訊引擎呼叫，固定 128 samples / call
   */
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel || channel.length === 0) return true;

    // 累積 128-sample 區塊
    for (let i = 0; i < channel.length; i++) {
      this._buffer.push(channel[i]);
    }

    // 達到目標大小時處理並送出
    while (this._buffer.length >= this._targetSourceSamples) {
      const chunk = new Float32Array(this._buffer.splice(0, this._targetSourceSamples));

      // 可選降採樣（線性插值）
      let output = chunk;
      if (this._resampleTo && this._resampleTo !== this._sourceRate) {
        output = this._downsample(chunk, this._sourceRate, this._resampleTo);
      }

      // 振幅診斷（在 worklet 端計算，避免主執行緒額外迴圈）
      let maxAmp = 0;
      for (let i = 0; i < output.length; i++) {
        const abs = Math.abs(output[i]);
        if (abs > maxAmp) maxAmp = abs;
      }

      // float32 → int16 PCM
      const int16 = new Int16Array(output.length);
      for (let i = 0; i < output.length; i++) {
        const s = Math.max(-1, Math.min(1, output[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      // 零複製傳送（transfer ArrayBuffer 所有權到主執行緒）
      this.port.postMessage(
        {
          int16: int16.buffer,
          outputRate: this._resampleTo || this._sourceRate,
          maxAmp
        },
        [int16.buffer]
      );
    }

    return true; // 回傳 true 保持節點存活
  }

  /**
   * 線性插值降採樣
   * @param {Float32Array} float32 - 原始樣本
   * @param {number} fromRate - 來源取樣率
   * @param {number} toRate - 目標取樣率
   * @returns {Float32Array}
   */
  _downsample(float32, fromRate, toRate) {
    const ratio = fromRate / toRate;
    const outLen = Math.floor(float32.length / ratio);
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const pos = i * ratio;
      const idx = Math.floor(pos);
      const frac = pos - idx;
      const a = float32[idx] !== undefined ? float32[idx] : 0;
      const b = float32[idx + 1] !== undefined ? float32[idx + 1] : float32[idx];
      out[i] = a + frac * (b - a);
    }
    return out;
  }
}

registerProcessor('audio-processor', AudioProcessor);
