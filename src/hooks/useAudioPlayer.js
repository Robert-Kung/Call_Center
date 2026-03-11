// Audio Player Hook - Playback for Base64 audio from TTS
// PCM 播放完全對齊官方 WebSocket 版做法 (AudioPlayer class in mediaUtils.js)
// ref: https://github.com/google-gemini/gemini-live-api-examples/blob/main/gemini-live-ephemeral-tokens-websocket/frontend/mediaUtils.js
import { useState, useRef, useCallback, useEffect } from 'react';

export function useAudioPlayer(options = {}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);

  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const queueRef = useRef([]);
  const isPlayingRef = useRef(false);

  // PCM Playback Worklet 相關（對齊官方 AudioPlayer）
  // 官方做法：init() 只呼叫一次，之後只 play()/interrupt()，不會 close/recreate
  const pcmCtxRef = useRef(null);
  const pcmWorkletRef = useRef(null);
  const pcmGainRef = useRef(null);
  const pcmInitializedRef = useRef(false);
  const pcmInitPromiseRef = useRef(null);  // 防止並行 init 競爭

  // 累積播放結束時間：解決多 chunk 同時到達時 onEnd 過早觸發的問題。
  // 每個 chunk postMessage 到 worklet 後，worklet queue 是 sequential，
  // 所以第 N 個 chunk 真正播完的時間 = max(上一個結束時間, 現在) + 本 chunk 時長。
  const pcmPlaybackEndTimeRef = useRef(0);

  // 待清除的 PCM onEnd setTimeout ID 列表。
  // stopPlayback / interrupt 時呼叫 clearTimeout 全部取消，
  // 避免殘留 callback 在 interrupt 後仍執行，造成 pendingAudioChunks 變成負數。
  const pcmPendingTimerIdsRef = useRef([]);

  // Initialize non-PCM audio element
  useEffect(() => {
    audioRef.current = new Audio();

    audioRef.current.addEventListener('timeupdate', () => {
      setCurrentTime(audioRef.current.currentTime);
    });

    audioRef.current.addEventListener('loadedmetadata', () => {
      setDuration(audioRef.current.duration);
    });

    audioRef.current.addEventListener('error', (e) => {
      if (!audioRef.current.src || audioRef.current.src === '') return;
      console.error('Audio playback error:', e);
      setError('音訊播放失敗');
      playNext();
    });

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      // 清理 PCM worklet（只在 unmount 時，對齊官方 destroy()）
      if (pcmCtxRef.current && pcmCtxRef.current.state !== 'closed') {
        pcmCtxRef.current.close();
      }
      pcmCtxRef.current = null;
      pcmWorkletRef.current = null;
      pcmGainRef.current = null;
      pcmInitializedRef.current = false;
      pcmInitPromiseRef.current = null;
    };
  }, []);

  /**
   * 初始化 PCM Playback（對齊官方 AudioPlayer.init()）
   *
   * 官方做法：建立一次 AudioContext(24kHz) + Worklet + GainNode，之後永遠複用
   * 不會在 play 之間 close/recreate，避免 "No execution context" 錯誤
   * 用 promise lock 防止多個 audio chunk 同時觸發 init 造成競爭
   */
  const initPCMPlayback = useCallback(async (sampleRate) => {
    // 已初始化且 context 仍存活 → 只需 resume
    if (pcmInitializedRef.current && pcmCtxRef.current?.state !== 'closed') {
      if (pcmCtxRef.current.state === 'suspended') {
        await pcmCtxRef.current.resume();
      }
      return;
    }

    // 防止並行 init（多個 chunk 同時到達時只跑一次）
    if (pcmInitPromiseRef.current) {
      await pcmInitPromiseRef.current;
      return;
    }

    const doInit = async () => {
      // 對齊官方：AudioContext 建在 24kHz，worklet + gain 一次性連接
      const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate });
      pcmCtxRef.current = ctx;

      const workletUrl = new URL('../worklets/pcmPlayback.worklet.js', import.meta.url);
      await ctx.audioWorklet.addModule(workletUrl);

      const workletNode = new AudioWorkletNode(ctx, 'pcm-playback-processor');
      const gainNode = ctx.createGain();
      gainNode.gain.value = 1.0;

      workletNode.connect(gainNode);
      gainNode.connect(ctx.destination);

      pcmWorkletRef.current = workletNode;
      pcmGainRef.current = gainNode;
      pcmInitializedRef.current = true;

      // 立即 resume（autoplay policy）
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      console.log('[AudioPlayer] PCM Playback 已初始化 (sampleRate=%d, ctx.state=%s)', sampleRate, ctx.state);
    };

    pcmInitPromiseRef.current = doInit();
    try {
      await pcmInitPromiseRef.current;
    } finally {
      pcmInitPromiseRef.current = null;
    }
  }, []);

  /**
   * 播放 PCM base64 音訊（對齊官方 AudioPlayer.play()）
   *
   * 官方做法：base64 → Int16 → Float32 → postMessage 到 Worklet
   * Worklet process() 持續從佇列拉資料填 output buffer → 零間隙播放
   */
  const playPCMAudio = useCallback(async (base64, sampleRate, onEnd) => {
    try {
      await initPCMPlayback(sampleRate);

      const ctx = pcmCtxRef.current;
      if (!ctx || ctx.state === 'closed') {
        throw new Error('PCM AudioContext not available');
      }
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // base64 → Int16 → Float32（與官方 play() 完全一致）
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
      }

      // 官方做法：直接 postMessage 到 worklet
      if (pcmWorkletRef.current) {
        pcmWorkletRef.current.port.postMessage(float32);
      } else {
        console.warn('[AudioPlayer] pcmWorkletRef is null, audio dropped!');
      }

      isPlayingRef.current = true;
      setIsPlaying(true);
      setError(null);

      // onEnd 回調：累積 queue 時長，確保 onEnd 在該 chunk 真正播完後才觸發
      // 若多個 chunk 同時到達，worklet queue 是 sequential，第 N 個 chunk
      // 實際播完時間 = max(上一個結束時間, 現在) + 本 chunk 時長
      if (onEnd) {
        const durationMs = (float32.length / sampleRate) * 1000;
        const now = performance.now();
        pcmPlaybackEndTimeRef.current = Math.max(pcmPlaybackEndTimeRef.current, now) + durationMs;
        const delayMs = pcmPlaybackEndTimeRef.current - now;
        const timerId = setTimeout(() => {
          pcmPendingTimerIdsRef.current = pcmPendingTimerIdsRef.current.filter(id => id !== timerId);
          onEnd();
        }, delayMs);
        pcmPendingTimerIdsRef.current.push(timerId);
      }
    } catch (err) {
      console.error('PCM playback failed:', err);
      setError('PCM 音訊播放失敗');
      if (onEnd) onEnd();
    }
  }, [initPCMPlayback]);

  // Play next item in non-PCM queue
  const playNext = useCallback(async () => {
    if (queueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      return;
    }

    const { base64, onEnd } = queueRef.current.shift();

    try {
      let audioFormat = 'audio/wav';
      if (base64.startsWith('UklGR')) {
        audioFormat = 'audio/wav';
      } else if (base64.startsWith('T2dnUw')) {
        audioFormat = 'audio/ogg';
      } else if (base64.startsWith('GkXfo')) {
        audioFormat = 'audio/webm';
      }

      const audioData = `data:${audioFormat};base64,${base64}`;
      audioRef.current.src = audioData;

      audioRef.current.onended = () => {
        if (onEnd) onEnd();
        playNext();
      };

      isPlayingRef.current = true;
      setIsPlaying(true);
      setError(null);

      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.error('Play failed:', err);
          if (err.name === 'NotAllowedError') {
            setError('瀏覽器阻止自動播放，請點擊頁面以啟用音訊');
          }
          playNext();
        });
      }
    } catch (err) {
      console.error('Failed to play audio:', err);
      setError('音訊解碼失敗');
      playNext();
    }
  }, []);

  /**
   * Play audio (PCM direct / non-PCM queue)
   */
  const playAudio = useCallback((base64Audio, onEndOrOptions = null) => {
    if (!base64Audio) return;

    let onEnd = null;
    let isPCM = false;
    let sampleRate = 24000;

    if (typeof onEndOrOptions === 'function') {
      onEnd = onEndOrOptions;
    } else if (onEndOrOptions && typeof onEndOrOptions === 'object') {
      onEnd = onEndOrOptions.onEnd || null;
      isPCM = onEndOrOptions.isPCM || false;
      sampleRate = onEndOrOptions.sampleRate || 24000;
    }

    // PCM: 透過 Playback Worklet 直接推入佇列
    if (isPCM) {
      playPCMAudio(base64Audio, sampleRate, onEnd);
      return;
    }

    // 非 PCM: 使用 Audio element 佇列
    queueRef.current.push({ base64: base64Audio, onEnd });
    if (!isPlayingRef.current) {
      playNext();
    }
  }, [playNext, playPCMAudio]);

  const playImmediate = useCallback((base64Audio) => {
    queueRef.current = [];
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (base64Audio) {
      queueRef.current.push({ base64: base64Audio, onEnd: null });
      playNext();
    }
  }, [playNext]);

  /**
   * Stop all playback and clear queue
   */
  const stopPlayback = useCallback(() => {
    queueRef.current = [];

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = '';
    }

    // 中斷 PCM Worklet 播放（對齊官方 AudioPlayer.interrupt()）
    if (pcmWorkletRef.current) {
      pcmWorkletRef.current.port.postMessage('interrupt');
    }
    // 取消所有待執行的 onEnd setTimeout，防止殘留 callback 汙染 pendingAudioChunks
    pcmPendingTimerIdsRef.current.forEach(id => clearTimeout(id));
    pcmPendingTimerIdsRef.current = [];
    pcmPlaybackEndTimeRef.current = 0;

    isPlayingRef.current = false;
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  const pause = useCallback(() => {
    if (audioRef.current && isPlayingRef.current) {
      audioRef.current.pause();
      isPlayingRef.current = false;
      setIsPlaying(false);
    }
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current && !isPlayingRef.current && audioRef.current.src) {
      audioRef.current.play().catch(console.error);
      isPlayingRef.current = true;
      setIsPlaying(true);
    }
  }, []);

  const getQueueLength = useCallback(() => {
    return queueRef.current.length;
  }, []);

  const enableAudio = useCallback(async () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      await audioContext.resume();
      audioContext.close();
      setError(null);
      return true;
    } catch {
      return false;
    }
  }, []);

  return {
    isPlaying,
    currentTime,
    duration,
    error,
    playAudio,
    playImmediate,
    stopPlayback,
    pause,
    resume,
    getQueueLength,
    enableAudio,
    clearError: () => setError(null)
  };
}

export default useAudioPlayer;
