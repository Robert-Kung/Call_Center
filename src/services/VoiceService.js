// Voice Service - High-level API for voice interactions
import { apiClient } from './ApiClient';
import { API_CONFIG } from '../config/api';
import { geminiLiveService } from './GeminiLiveService';
import { restWebSocketService } from './RestWebSocketService';

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

  // ==================== REST WebSocket Methods ====================

  /**
   * Initialize a REST WebSocket session
   * @param {object} scenario - Scenario object with id, name, etc.
   * @returns {Promise<{ai_text: string, audio_base64: string, sessionId: string, latency: object}>}
   */
  async initializeCallRestWs(scenario) {
    this.scenarioId = scenario.id;
    const response = await restWebSocketService.initialize(scenario);
    this.sessionId = response.sessionId;
    return {
      ai_text:      response.aiText     || '',
      audio_base64: response.audioBase64 || null,
      sessionId:    response.sessionId,
      latency:      response.latency
    };
  }

  /**
   * Start REST WebSocket streaming
   * @param {MediaStream} mediaStream
   */
  async startRestWsStreaming(mediaStream) {
    return restWebSocketService.startStreaming(mediaStream);
  }

  /**
   * Stop REST WebSocket streaming
   */
  stopRestWsStreaming() {
    restWebSocketService.stopStreaming();
  }

  /**
   * Check if REST WebSocket is currently streaming
   */
  isRestWsStreaming() {
    return restWebSocketService.isCurrentlyStreaming();
  }

  /**
   * Get the restWebSocketService instance (for setting callbacks)
   */
  getRestWsService() {
    return restWebSocketService;
  }

  /**
   * End REST WebSocket session
   */
  endRestWsSession() {
    restWebSocketService.close();
    this.sessionId = null;
    this.scenarioId = null;
  }

  /**
   * Get REST WebSocket connection status
   */
  getRestWsConnectionStatus() {
    return restWebSocketService.getConnectionStatus();
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
