// Audio Player Hook - Playback for Base64 audio from TTS
import { useState, useRef, useCallback, useEffect } from 'react';

export function useAudioPlayer(options = {}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);

  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const queueRef = useRef([]);
  const isPlayingRef = useRef(false); // For avoiding stale closure

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio();

    audioRef.current.addEventListener('timeupdate', () => {
      setCurrentTime(audioRef.current.currentTime);
    });

    audioRef.current.addEventListener('loadedmetadata', () => {
      setDuration(audioRef.current.duration);
    });

    audioRef.current.addEventListener('error', (e) => {
      // Ignore errors when no source is set (initial empty Audio element)
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
    };
  }, []);

  /**
   * Play raw PCM audio via AudioContext (for Gemini Live 24kHz output)
   */
  const playPCMAudio = useCallback(async (base64, sampleRate, onEnd) => {
    try {
      // Decode base64 to binary
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      // Convert to 16-bit PCM samples
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
      }

      // Create AudioContext and buffer
      const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate });
      audioContextRef.current = ctx;

      const audioBuffer = ctx.createBuffer(1, float32.length, sampleRate);
      audioBuffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      isPlayingRef.current = true;
      setIsPlaying(true);
      setError(null);

      source.onended = () => {
        ctx.close();
        if (onEnd) onEnd();
        playNext();
      };

      source.start();
    } catch (err) {
      console.error('PCM playback failed:', err);
      setError('PCM 音訊播放失敗');
      playNext();
    }
  }, []);

  // Play next item in queue
  const playNext = useCallback(async () => {
    if (queueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      return;
    }

    const { base64, onEnd, isPCM, sampleRate } = queueRef.current.shift();

    try {
      // Handle raw PCM audio (e.g., from Gemini Live API at 24kHz)
      if (isPCM) {
        await playPCMAudio(base64, sampleRate || 24000, onEnd);
        return;
      }

      // Determine audio format from base64 header or default to wav
      let audioFormat = 'audio/wav';
      if (base64.startsWith('UklGR')) {
        audioFormat = 'audio/wav';  // RIFF header
      } else if (base64.startsWith('T2dnUw')) {
        audioFormat = 'audio/ogg';  // OggS header
      } else if (base64.startsWith('GkXfo')) {
        audioFormat = 'audio/webm'; // webm header
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
          // Auto-play might be blocked, still try next
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
   * Add audio to playback queue
   * @param {string} base64Audio - Base64 encoded audio
   * @param {function|object} onEndOrOptions - Callback when audio finishes, or options object
   *   Options: { onEnd, isPCM, sampleRate }
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

    queueRef.current.push({ base64: base64Audio, onEnd, isPCM, sampleRate });

    // Start playback if not already playing
    if (!isPlayingRef.current) {
      playNext();
    }
  }, [playNext]);

  /**
   * Play audio immediately, clearing queue
   * @param {string} base64Audio - Base64 encoded audio
   */
  const playImmediate = useCallback((base64Audio) => {
    // Clear queue
    queueRef.current = [];

    // Stop current playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    // Play new audio
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

    isPlayingRef.current = false;
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  /**
   * Pause current playback
   */
  const pause = useCallback(() => {
    if (audioRef.current && isPlayingRef.current) {
      audioRef.current.pause();
      isPlayingRef.current = false;
      setIsPlaying(false);
    }
  }, []);

  /**
   * Resume playback
   */
  const resume = useCallback(() => {
    if (audioRef.current && !isPlayingRef.current && audioRef.current.src) {
      audioRef.current.play().catch(console.error);
      isPlayingRef.current = true;
      setIsPlaying(true);
    }
  }, []);

  /**
   * Get queue length
   */
  const getQueueLength = useCallback(() => {
    return queueRef.current.length;
  }, []);

  /**
   * Enable audio context (for browsers that require user interaction)
   */
  const enableAudio = useCallback(async () => {
    try {
      // Create a silent audio context to unlock audio
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
