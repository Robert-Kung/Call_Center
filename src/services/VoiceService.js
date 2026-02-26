// Voice Service - High-level API for voice interactions
import { apiClient } from './ApiClient';
import { SYSTEM_PROMPTS, WELCOME_MESSAGES, API_CONFIG } from '../config/api';
import { geminiLiveService } from './GeminiLiveService';

class VoiceService {
  constructor(client = apiClient) {
    this.client = client;
    this.sessionId = null;
    this.scenarioId = null;
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `session-${timestamp}-${random}`;
  }

  /**
   * Initialize a new call session
   * @param {object} scenario - Scenario object with id, name, etc.
   * @returns {Promise<{ai_text: string, audio_base64: string, sessionId: string}>}
   */
  async initializeCall(scenario) {
    this.sessionId = this.generateSessionId();
    this.scenarioId = scenario.id;

    const systemPrompt = this._getSystemPrompt(scenario);
    const welcomeMessage = this._getWelcomeMessage(scenario);
    const voiceId = scenario.voiceId || API_CONFIG.defaultVoiceId;

    const startTime = performance.now();

    const response = await this.client.startSession(
      this.sessionId,
      systemPrompt,
      welcomeMessage,
      voiceId
    );

    const totalTime = Math.round(performance.now() - startTime);

    return {
      ...response,
      sessionId: this.sessionId,
      latency: {
        tts: totalTime,  // Only TTS for initialization
        total: totalTime
      }
    };
  }

  /**
   * Process user audio through ASR -> LLM -> TTS pipeline
   * @param {Blob} audioBlob - Recorded audio
   * @param {object} scenario - Current scenario
   * @returns {Promise<{user_text: string, ai_text: string, audio_base64: string, latency: object}>}
   */
  async processUserAudio(audioBlob, scenario) {
    if (!this.sessionId) {
      throw new Error('No active session. Call initializeCall first.');
    }

    const systemPrompt = this._getSystemPrompt(scenario);
    const voiceId = scenario.voiceId || API_CONFIG.defaultVoiceId;

    const startTime = performance.now();

    const response = await this.client.sendAudio(
      this.sessionId,
      audioBlob,
      systemPrompt,
      voiceId
    );

    const totalTime = Math.round(performance.now() - startTime);

    // If backend doesn't provide latency, estimate based on total time
    const latency = response.latency || this._estimateLatency(totalTime);

    return {
      ...response,
      latency: {
        ...latency,
        total: totalTime
      }
    };
  }

  /**
   * End current session
   */
  endSession() {
    const sessionId = this.sessionId;
    this.sessionId = null;
    this.scenarioId = null;
    return sessionId;
  }

  /**
   * Get system prompt for scenario
   */
  _getSystemPrompt(scenario) {
    // Use predefined prompt or build from scenario data
    if (SYSTEM_PROMPTS[scenario.id]) {
      return SYSTEM_PROMPTS[scenario.id];
    }

    // Build dynamic prompt from scenario
    return `你是${scenario.companyInfo?.name || scenario.name}的AI客服助理。
請用繁體中文、親切專業的語氣回答客戶問題。
回答請簡潔，每次回覆控制在50字以內。`;
  }

  /**
   * Get welcome message for scenario
   */
  _getWelcomeMessage(scenario) {
    if (WELCOME_MESSAGES[scenario.id]) {
      return WELCOME_MESSAGES[scenario.id];
    }

    return `您好，歡迎致電${scenario.companyInfo?.name || scenario.name}，請問有什麼可以為您服務的？`;
  }

  /**
   * Estimate latency breakdown when not provided by backend
   */
  _estimateLatency(totalTime) {
    // Rough estimation: ASR 25%, LLM 55%, TTS 20%
    return {
      asr: Math.round(totalTime * 0.25),
      llm: Math.round(totalTime * 0.55),
      tts: Math.round(totalTime * 0.20)
    };
  }

  /**
   * Check if service is available
   */
  async checkHealth() {
    return await this.client.healthCheck();
  }

  /**
   * Get current session info
   */
  getSessionInfo() {
    return {
      sessionId: this.sessionId,
      scenarioId: this.scenarioId,
      isActive: !!this.sessionId
    };
  }

  // ==================== Gemini Live Methods ====================

  /**
   * Initialize a Gemini Live session
   * @param {object} scenario - Scenario object with id, name, etc.
   * @returns {Promise<{ai_text: string, audio_base64: string, sessionId: string, latency: object}>}
   */
  async initializeCallGeminiLive(scenario) {
    this.scenarioId = scenario.id;

    const response = await geminiLiveService.initialize(scenario);

    this.sessionId = response.sessionId;

    return {
      ai_text: response.aiText || '',
      audio_base64: response.audioBase64 || '',
      sessionId: response.sessionId,
      latency: response.latency
    };
  }

  /**
   * Process user audio through Gemini Live (deprecated - streaming mode handles this via callbacks)
   * @deprecated Use startGeminiStreaming() + callbacks instead
   */
  async processUserAudioGeminiLive(audioBlob, scenario) {
    console.warn('[VoiceService] processUserAudioGeminiLive is deprecated. Use streaming mode instead.');
    return {
      user_text: '',
      ai_text: '',
      audio_base64: '',
      latency: { total: 0, e2e: 0 },
      tokenUsage: geminiLiveService.getTokenUsage()
    };
  }

  /**
   * Start Gemini Live streaming with a media stream
   * @param {MediaStream} mediaStream
   */
  async startGeminiStreaming(mediaStream) {
    return geminiLiveService.startStreaming(mediaStream);
  }

  /**
   * Stop Gemini Live streaming
   */
  stopGeminiStreaming() {
    geminiLiveService.stopStreaming();
  }

  /**
   * Check if Gemini Live is currently streaming
   */
  isGeminiStreaming() {
    return geminiLiveService.isCurrentlyStreaming();
  }

  /**
   * Get the geminiLiveService instance (for setting callbacks)
   */
  getGeminiLiveService() {
    return geminiLiveService;
  }

  /**
   * End Gemini Live session
   */
  endGeminiSession() {
    geminiLiveService.close();
    const sessionId = this.sessionId;
    this.sessionId = null;
    this.scenarioId = null;
    return sessionId;
  }

  /**
   * Get Gemini connection status
   */
  getGeminiConnectionStatus() {
    return geminiLiveService.getConnectionStatus();
  }

  /**
   * Get Gemini token usage
   */
  getGeminiTokenUsage() {
    return geminiLiveService.getTokenUsage();
  }
}

// Export singleton instance
export const voiceService = new VoiceService();
export default VoiceService;
