/**
 * HistoryView.jsx
 * 歷史紀錄總覽頁 — 統計摘要 + session 列表 + 詳細頁面
 */
import React, { useState, useEffect, useMemo } from 'react';
import { History, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import StatsOverview from '../components/history/StatsOverview';
import SessionTable from '../components/history/SessionTable';
import SessionDetail from '../components/history/SessionDetail';
import {
  fetchSessionList,
  fetchSessionDetail,
  computeStats,
} from '../services/SessionHistoryService';

export default function HistoryView() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 詳細頁：{ summary, session }
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 載入 session 列表
  async function loadSessions() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSessionList();
      setSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadSessions(); }, []);

  // 聚合統計
  const stats = useMemo(() => computeStats(sessions), [sessions]);

  // 點擊 session → 讀取完整資料
  async function handleSelect(summary) {
    if (!summary.filename) {
      // 沒有 filename，僅用摘要顯示
      setDetail({ summary, session: { ...summary, events: [], summary: [] } });
      return;
    }
    setDetailLoading(true);
    setDetail({ summary, session: null });   // 先顯示 loading 狀態
    const session = await fetchSessionDetail(summary.filename);
    setDetail({ summary, session: session || { ...summary, events: [], summary: [] } });
    setDetailLoading(false);
  }

  // 返回列表
  function handleBack() {
    setDetail(null);
  }

  // ── Detail 頁 ───────────────────────────────────────────────────────────────
  if (detail) {
    if (detailLoading || !detail.session) {
      return (
        <div className="h-full flex items-center justify-center bg-slate-900">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            <p className="text-slate-400 text-sm">載入 Session 詳細資料…</p>
          </div>
        </div>
      );
    }
    return (
      <div className="h-full bg-slate-900">
        <SessionDetail
          summary={detail.summary}
          session={detail.session}
          onBack={handleBack}
        />
      </div>
    );
  }

  // ── 列表頁 ──────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-slate-900 overflow-hidden">
      {/* 頁面標題列 */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-700/50 bg-slate-800/50 flex items-center gap-3">
        <div className="w-9 h-9 bg-indigo-500/20 rounded-xl flex items-center justify-center">
          <History className="w-5 h-5 text-indigo-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-bold text-white">歷史紀錄</h1>
          <p className="text-xs text-slate-400">Session History · 通話記錄總覽與分析</p>
        </div>
        <button
          onClick={loadSessions}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? '載入中…' : '重新整理'}
        </button>
      </div>

      {/* 主內容 */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

        {/* 錯誤狀態 */}
        {error && (
          <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-sm text-red-300 font-medium">無法載入歷史紀錄</p>
              <p className="text-xs text-red-400/70 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* 載入中 */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              <p className="text-slate-400 text-sm">載入 session 資料中…</p>
            </div>
          </div>
        )}

        {/* 資料已載入 */}
        {!loading && !error && (
          <>
            {/* 統計摘要區塊 */}
            <StatsOverview stats={stats} />

            {/* Session 列表表格 */}
            <div className="min-h-[320px]">
              <SessionTable sessions={sessions} onSelect={handleSelect} />
            </div>
          </>
        )}

        {/* 空狀態 */}
        {!loading && !error && sessions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <History className="w-12 h-12 text-slate-600 mb-3" />
            <p className="text-slate-400 font-medium">還沒有任何通話紀錄</p>
            <p className="text-slate-600 text-sm mt-1">進行一次 AI 語音通話後，紀錄會自動出現這裡</p>
          </div>
        )}
      </div>
    </div>
  );
}
