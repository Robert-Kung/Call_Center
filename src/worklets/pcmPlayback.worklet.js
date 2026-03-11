/**
 * PCM Playback Worklet — 從佇列持續填充 output buffer
 *
 * 官方做法 (gemini-live-ephemeral-tokens-websocket/audio-processors/playback.worklet.js):
 * - 主執行緒透過 port.postMessage(Float32Array) 推入音訊
 * - process() 每次被呼叫時從佇列拉資料填 output channel
 * - 用 "interrupt" 訊息清空佇列（中斷播放）
 *
 * 優點：不用 BufferSource.start(scheduledTime)，零排程延遲，零間隙
 */
class PCMPlaybackProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.audioQueue = [];
    this._totalReceived = 0;
    this._totalPlayed = 0;

    this.port.onmessage = (event) => {
      if (event.data === 'interrupt') {
        this.audioQueue = [];
        this._totalPlayed = 0;
        console.log('[PCMPlayback] interrupt — queue cleared');
      } else if (event.data && event.data.length > 0) {
        // 不依賴 instanceof（跨 realm 可能失敗）
        // 確保是 Float32Array；若不是則轉換
        const buf = (event.data.constructor === Float32Array)
          ? event.data
          : new Float32Array(event.data);
        this.audioQueue.push(buf);
        this._totalReceived += buf.length;
        if (this._totalReceived <= buf.length) {
          // 第一筆資料
          console.log('[PCMPlayback] 首筆資料: samples=%d, sampleRate=%d', buf.length, sampleRate);
        }
      }
    };
  }

  process(inputs, outputs) {
    const output = outputs[0];
    if (output.length === 0) return true;

    const channel = output[0];
    let outputIndex = 0;

    // 從佇列填充 output buffer
    while (outputIndex < channel.length && this.audioQueue.length > 0) {
      const currentBuffer = this.audioQueue[0];

      if (!currentBuffer || currentBuffer.length === 0) {
        this.audioQueue.shift();
        continue;
      }

      const remainingOutput = channel.length - outputIndex;
      const remainingBuffer = currentBuffer.length;
      const copyLength = Math.min(remainingOutput, remainingBuffer);

      for (let i = 0; i < copyLength; i++) {
        channel[outputIndex++] = currentBuffer[i];
      }

      if (copyLength < remainingBuffer) {
        // 部分消耗，保留剩餘
        this.audioQueue[0] = currentBuffer.slice(copyLength);
      } else {
        this.audioQueue.shift();
      }
    }

    // 剩餘填靜音
    while (outputIndex < channel.length) {
      channel[outputIndex++] = 0;
    }

    return true;
  }
}

registerProcessor('pcm-playback-processor', PCMPlaybackProcessor);
