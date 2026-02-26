/**
 * SessionLogger - 對話記錄持久化服務
 *
 * 功能:
 * 1. 記錄所有 Gemini Live 對話事件 (連線、音訊、轉錄、錯誤)
 * 2. 儲存到 localStorage (瀏覽器端持久化)
 * 3. POST 到 /api/session-log (Vite plugin 寫入 data/ 資料夾 + Docker log)
 * 4. 提供下載 JSON 功能
 */

class SessionLogger {
  constructor() {
    this._sessionId = null;
    this._events = [];
    this._startTime = null;
    this._scenarioId = null;
    this._scenarioName = null;
  }

  /**
   * 開始一個新的 session 記錄
   */
  startSession(sessionId, scenarioId, scenarioName) {
    this._sessionId = sessionId;
    this._scenarioId = scenarioId;
    this._scenarioName = scenarioName;
    this._startTime = new Date().toISOString();
    this._events = [];

    this.log('session_start', {
      sessionId,
      scenarioId,
      scenarioName,
      timestamp: this._startTime
    });
  }

  /**
   * 記錄事件
   * @param {string} type - 事件類型
   * @param {object} data - 事件資料
   */
  log(type, data = {}) {
    const event = {
      type,
      timestamp: new Date().toISOString(),
      elapsed: this._startTime ? Date.now() - new Date(this._startTime).getTime() : 0,
      ...data
    };

    this._events.push(event);

    // 同步印到 console (瀏覽器端)
    const textPreview = data.text || data.aiText || data.userText || '';
    const prefix = `[SessionLog][${type}]`;
    if (textPreview) {
      console.log(`${prefix} ${textPreview}`);
    } else {
      console.log(`${prefix}`, data);
    }

    // 非同步送到 server 寫檔 + Docker log
    this._postToServer(event);
  }

  /**
   * 記錄對話回合
   */
  logTurn(turnData) {
    this.log('turn_complete', {
      userText: turnData.userText || '',
      aiText: turnData.aiText || '',
      audioChunks: turnData.audioChunks || 0,
      audioLength: turnData.audioLength || 0,
      latency: turnData.latency || 0,
      tokenUsage: turnData.tokenUsage || null
    });
  }

  /**
   * 記錄音訊串流統計
   */
  logAudioStats(stats) {
    this.log('audio_stats', stats);
  }

  /**
   * 結束 session 並儲存
   */
  endSession() {
    this.log('session_end', {
      totalEvents: this._events.length,
      duration: this._startTime ? Date.now() - new Date(this._startTime).getTime() : 0
    });

    // 儲存到 localStorage
    this._saveToLocalStorage();

    // 送完整 session 到 server 寫檔案
    this._postSessionToServer();
  }

  /**
   * 取得目前 session 的所有事件
   */
  getEvents() {
    return [...this._events];
  }

  /**
   * 取得對話摘要 (只有 turn_complete 的文字)
   */
  getConversationSummary() {
    return this._events
      .filter(e => e.type === 'turn_complete')
      .map(e => ({
        userText: e.userText,
        aiText: e.aiText,
        latency: e.latency,
        elapsed: e.elapsed
      }));
  }

  /**
   * 下載為 JSON 檔案
   */
  downloadAsJSON() {
    const session = this._buildSessionObject();
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${this._sessionId || 'unknown'}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * 從 localStorage 載入歷史 sessions
   */
  static getStoredSessions() {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('gemini-session-'));
      return keys.map(k => {
        try {
          return JSON.parse(localStorage.getItem(k));
        } catch {
          return null;
        }
      }).filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * 清除所有歷史 sessions
   */
  static clearStoredSessions() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('gemini-session-'));
    keys.forEach(k => localStorage.removeItem(k));
  }

  // ==================== Private ====================

  _buildSessionObject() {
    return {
      sessionId: this._sessionId,
      scenarioId: this._scenarioId,
      scenarioName: this._scenarioName,
      startTime: this._startTime,
      endTime: new Date().toISOString(),
      events: this._events,
      summary: this.getConversationSummary()
    };
  }

  _saveToLocalStorage() {
    try {
      const key = `gemini-session-${this._sessionId || Date.now()}`;
      const session = this._buildSessionObject();
      localStorage.setItem(key, JSON.stringify(session));
      console.log(`[SessionLog] 已儲存到 localStorage: ${key}`);
    } catch (err) {
      console.warn('[SessionLog] localStorage 儲存失敗:', err.message);
    }
  }

  async _postToServer(event) {
    try {
      await fetch('/api/session-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this._sessionId,
          event
        })
      });
    } catch {
      // 靜默失敗 — server 端可能未配置
    }
  }

  async _postSessionToServer() {
    try {
      const session = this._buildSessionObject();
      await fetch('/api/session-log/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(session)
      });
    } catch {
      // 靜默失敗
    }
  }
}

// 導出單例
export const sessionLogger = new SessionLogger();
export default SessionLogger;
