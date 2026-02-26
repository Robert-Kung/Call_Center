// HTTP Client for Voice Assistant Backend
import { API_CONFIG } from '../config/api';

class ApiClient {
  constructor(baseUrl = API_CONFIG.baseUrl, options = {}) {
    this.baseUrl = baseUrl;
    this.timeout = options.timeout || API_CONFIG.timeout;
    this.retries = options.retries || API_CONFIG.retries;
  }

  /**
   * Start a new call session with welcome message
   * @param {string} sessionId - Unique session identifier
   * @param {string} systemPrompt - System instructions for LLM
   * @param {string} initialResponse - Welcome message to speak
   * @param {string} voiceId - TTS voice character
   * @returns {Promise<{user_text: string, ai_text: string, audio_base64: string}>}
   */
  async startSession(sessionId, systemPrompt, initialResponse, voiceId = 'Verna') {
    const url = `${this.baseUrl}${API_CONFIG.endpoints.talk}`;

    const body = {
      session_id: sessionId,
      text_input: 'START_CALL_TRIGGER',
      system_prompt: systemPrompt,
      initial_response: initialResponse,
      voice_id: voiceId
    };

    return this._fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  }

  /**
   * Send audio for processing (ASR -> LLM -> TTS)
   * @param {string} sessionId - Session identifier
   * @param {Blob} audioBlob - Audio data (webm/wav)
   * @param {string} systemPrompt - Fallback system prompt
   * @param {string} voiceId - TTS voice character
   * @returns {Promise<{user_text: string, ai_text: string, audio_base64: string, latency?: object}>}
   */
  async sendAudio(sessionId, audioBlob, systemPrompt, voiceId = 'Verna') {
    const url = `${this.baseUrl}${API_CONFIG.endpoints.talk}`;

    const formData = new FormData();

    // Convert webm to wav-compatible format if needed
    const audioFile = new File([audioBlob], 'audio.wav', {
      type: audioBlob.type || 'audio/wav'
    });

    formData.append('file', audioFile);
    formData.append('session_id', sessionId);
    formData.append('voice_id', voiceId);
    formData.append('system_prompt', systemPrompt);

    return this._fetchWithRetry(url, {
      method: 'POST',
      body: formData
      // Note: Don't set Content-Type header for FormData, browser sets it with boundary
    });
  }

  /**
   * Internal fetch with timeout and retry logic
   */
  async _fetchWithRetry(url, options, retriesLeft = this.retries) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      // Retry on network errors, not on abort or HTTP errors
      if (retriesLeft > 0 && error.name !== 'AbortError' && !error.message.startsWith('HTTP')) {
        console.warn(`Retrying request, ${retriesLeft} attempts left...`);
        await this._delay(1000); // Wait 1 second before retry
        return this._fetchWithRetry(url, options, retriesLeft - 1);
      }

      // Transform error for better UX
      if (error.name === 'AbortError') {
        throw new Error('請求逾時，請檢查網路連線');
      }
      if (error.message === 'Failed to fetch') {
        throw new Error('無法連接語音服務，請確認後端是否運行');
      }

      throw error;
    }
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Health check for backend availability
   */
  async healthCheck() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.baseUrl}/`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
export default ApiClient;
