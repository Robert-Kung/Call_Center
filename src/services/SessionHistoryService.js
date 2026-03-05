/**
 * SessionHistoryService.js
 * 歷史 session 資料讀取與統計服務層
 */

const API_BASE = '/api/sessions';

/** 從 sessionId 前綴推斷 voiceMode */
export function inferMode(sessionId) {
  if (!sessionId) return 'legacy';
  if (sessionId.startsWith('gemini-')) return 'gemini';
  if (sessionId.startsWith('rest-ws-')) return 'rest-ws';
  return 'legacy';
}

/** 模式顯示設定 */
export const MODE_CONFIG = {
  gemini: { label: 'Gemini Live', color: 'purple', bg: 'bg-purple-500/20', text: 'text-purple-300', dot: 'bg-purple-400' },
  'rest-ws': { label: 'WS Live', color: 'cyan', bg: 'bg-cyan-500/20', text: 'text-cyan-300', dot: 'bg-cyan-400' },
  legacy: { label: 'Legacy', color: 'slate', bg: 'bg-slate-500/20', text: 'text-slate-300', dot: 'bg-slate-400' },
};

/** 格式化持續時間（ms → 可讀字串） */
export function formatDuration(ms) {
  if (!ms || ms <= 0) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

/** 格式化時間戳記為本地時間字串 */
export function formatTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('zh-TW', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
  } catch { return iso; }
}

/** 格式化延遲數值 */
export function formatLatency(ms) {
  if (ms == null) return '—';
  return `${ms.toLocaleString()}ms`;
}

/**
 * 從 session 摘要列表計算聚合統計
 * @param {Array} sessions - buildSessionSummary 產出的摘要陣列
 */
export function computeStats(sessions) {
  if (!sessions || sessions.length === 0) {
    return {
      total: 0,
      modeDistribution: [],
      scenarioDistribution: [],
      intentDistribution: [],
      latencyTrend: [],
      avgLatency: 0,
      avgTurns: 0,
      totalTokens: 0,
      totalTickets: 0,
      intentRate: 0,
    };
  }

  const modeCount = {};
  const scenarioCount = {};
  const intentCount = {};
  let totalLatency = 0, latencyCount = 0;
  let totalTurns = 0;
  let totalTokens = 0;
  let totalTickets = 0;
  let intentSessions = 0;

  const latencyTrend = [];

  sessions.forEach(s => {
    // 模式分佈
    const mode = s.mode || inferMode(s.sessionId);
    modeCount[mode] = (modeCount[mode] || 0) + 1;

    // 情境分佈
    const scenarioName = s.scenarioName || s.scenarioId || '未知情境';
    scenarioCount[scenarioName] = (scenarioCount[scenarioName] || 0) + 1;

    // 延遲
    if (s.avgLatency != null) {
      totalLatency += s.avgLatency;
      latencyCount++;
    }
    if (s.startTime && s.avgLatency != null) {
      latencyTrend.push({ time: s.startTime, latency: s.avgLatency, sessionId: s.sessionId });
    }

    // 輪次與 tokens
    totalTurns += s.turnCount || 0;
    totalTokens += s.totalTokens || 0;
    totalTickets += s.ticketCount || 0;
    if ((s.intentCount || 0) > 0) intentSessions++;

    // 意圖分佈
    (s.intents || []).forEach(intent => {
      intentCount[intent] = (intentCount[intent] || 0) + 1;
    });
  });

  // 按時間排序延遲趨勢
  latencyTrend.sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  return {
    total: sessions.length,
    modeDistribution: Object.entries(modeCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
    scenarioDistribution: Object.entries(scenarioCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
    intentDistribution: Object.entries(intentCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10),
    latencyTrend,
    avgLatency: latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0,
    avgTurns: sessions.length > 0
      ? (totalTurns / sessions.length).toFixed(1)
      : '0',
    totalTokens,
    totalTickets,
    intentRate: sessions.length > 0
      ? Math.round(intentSessions / sessions.length * 100)
      : 0,
  };
}

/**
 * 讀取所有 session 摘要列表
 * 優先嘗試 dev Vite plugin API，fallback 到靜態索引檔
 */
export async function fetchSessionList() {
  try {
    const res = await fetch(API_BASE);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    // Fallback：靜態索引（production 環境）
    try {
      const res = await fetch('/data/sessions-index.json');
      if (!res.ok) throw new Error('No index');
      return await res.json();
    } catch {
      return [];
    }
  }
}

/**
 * 讀取單一 session 完整 JSON
 * @param {string} filename - 如 "session-gemini-xxx.json"
 */
export async function fetchSessionDetail(filename) {
  try {
    const res = await fetch(`${API_BASE}/${filename}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    try {
      const res = await fetch(`/data/${filename}`);
      if (!res.ok) throw new Error('Not found');
      return await res.json();
    } catch {
      return null;
    }
  }
}
