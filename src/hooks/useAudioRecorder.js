// Audio Recorder Hook - Web Audio API for microphone capture
import { useState, useRef, useCallback, useEffect } from 'react';

export function useAudioRecorder(options = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState('unknown'); // 'unknown' | 'granted' | 'denied' | 'prompt'

  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  // Check microphone permission on mount
  useEffect(() => {
    const checkPermission = async () => {
      try {
        if (navigator.permissions) {
          const result = await navigator.permissions.query({ name: 'microphone' });
          setPermissionStatus(result.state);
          result.addEventListener('change', () => {
            setPermissionStatus(result.state);
          });
        }
      } catch {
        // Some browsers don't support permission query for microphone
        setPermissionStatus('unknown');
      }
    };
    checkPermission();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Monitor audio level for visual feedback
  const monitorAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate RMS for more accurate level representation
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / dataArray.length);
    const normalizedLevel = Math.min(rms / 128, 1); // Normalize to 0-1

    setAudioLevel(normalizedLevel);

    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(monitorAudioLevel);
    }
  }, [isRecording]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setError(null);

      // Request microphone access with optimized settings for speech
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000, // Whisper prefers 16kHz
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = stream;
      setPermissionStatus('granted');

      // Setup audio context for level monitoring
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;

      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      // Setup MediaRecorder with best available format
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/wav')) {
        mimeType = 'audio/wav';
      }

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 16000
      });

      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.start(100); // Collect data every 100ms
      setIsRecording(true);

      // Start level monitoring
      animationFrameRef.current = requestAnimationFrame(monitorAudioLevel);

    } catch (err) {
      console.error('Failed to start recording:', err);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionStatus('denied');
        setError('麥克風權限被拒絕，請在瀏覽器設定中允許麥克風存取');
      } else if (err.name === 'NotFoundError') {
        setError('找不到麥克風設備');
      } else {
        setError(`錄音失敗: ${err.message}`);
      }
    }
  }, [monitorAudioLevel]);

  // Stop recording and return audio blob
  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        setIsRecording(false);
        setAudioLevel(0);
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        const mimeType = mediaRecorderRef.current.mimeType;
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });

        // Cleanup stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        // Cleanup audio context
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }

        setIsRecording(false);
        setAudioLevel(0);

        // Only resolve with blob if it has content
        if (audioBlob.size > 0) {
          resolve(audioBlob);
        } else {
          resolve(null);
        }
      };

      mediaRecorderRef.current.stop();
    });
  }, []);

  // Cancel recording without returning data
  const cancelRecording = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {}; // Prevent resolve
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    chunksRef.current = [];
    setIsRecording(false);
    setAudioLevel(0);
  }, []);

  // Request permission explicitly
  const requestPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setPermissionStatus('granted');
      setError(null);
      return true;
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setPermissionStatus('denied');
      }
      setError('無法取得麥克風權限');
      return false;
    }
  }, []);

  return {
    isRecording,
    audioLevel,
    error,
    permissionStatus,
    startRecording,
    stopRecording,
    cancelRecording,
    requestPermission,
    clearError: () => setError(null)
  };
}

export default useAudioRecorder;
