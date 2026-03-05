/**
 * SessionTable.jsx
 * 可篩選與排序的 session 列表表格
 */
import React, { useState, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, Filter, ExternalLink, MessageSquare, Clock, Activity } from 'lucide-react';
import { MODE_CONFIG, inferMode, formatTime, formatDuration, formatLatency } from '../../services/SessionHistoryService';

const SORT_FIELDS = {
  startTime: '時間',
  turnCount: '輪次',
  avgLatency: '延遲',
  duration: '時長',
};

function SortIcon({ field, sortField, sortDir }) {
  if (sortField !== field) return <ChevronsUpDown className="w-3 h-3 text-slate-500" />;
  return sortDir === 'asc'
    ? <ChevronUp className="w-3 h-3 text-indigo-400" />
    : <ChevronDown className="w-3 h-3 text-indigo-400" />;
}

function ModeBadge({ mode }) {
  const cfg = MODE_CONFIG[mode] || MODE_CONFIG.legacy;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function IntentTags({ intents }) {
  if (!intents || intents.length === 0) return <span className="text-slate-600 text-xs">—</span>;
  const shown = intents.slice(0, 2);
  const rest = intents.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((intent, i) => (
        <span key={i} className="px-1.5 py-0.5 bg-purple-500/15 text-purple-300 rounded text-xs truncate max-w-[90px]" title={intent}>
          {intent}
        </span>
      ))}
      {rest > 0 && <span className="px-1.5 py-0.5 bg-slate-600/50 text-slate-400 rounded text-xs">+{rest}</span>}
    </div>
  );
}

function LatencyBadge({ ms }) {
  if (ms == null) return <span className="text-slate-600 text-xs">—</span>;
  const color = ms < 2000 ? 'text-emerald-400' : ms < 4000 ? 'text-amber-400' : 'text-red-400';
  return <span className={`text-xs font-mono font-medium ${color}`}>{ms.toLocaleString()}ms</span>;
}

export default function SessionTable({ sessions, onSelect }) {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [filterScenario, setFilterScenario] = useState('all');
  const [sortField, setSortField] = useState('startTime');
  const [sortDir, setSortDir] = useState('desc');

  // 情境選項
  const scenarioOptions = useMemo(() => {
    const names = [...new Set(sessions.map(s => s.scenarioName || s.scenarioId || '未知情境'))];
    return names.sort();
  }, [sessions]);

  // 篩選 + 搜尋 + 排序
  const filtered = useMemo(() => {
    let list = [...sessions];

    if (filterMode !== 'all') list = list.filter(s => (s.mode || inferMode(s.sessionId)) === filterMode);
    if (filterScenario !== 'all') list = list.filter(s => (s.scenarioName || s.scenarioId || '未知情境') === filterScenario);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(s =>
        (s.sessionId || '').toLowerCase().includes(q) ||
        (s.scenarioName || '').toLowerCase().includes(q) ||
        (s.intents || []).some(i => i.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      let va = a[sortField], vb = b[sortField];
      if (sortField === 'startTime') { va = va || ''; vb = vb || ''; }
      else { va = va ?? -1; vb = vb ?? -1; }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [sessions, filterMode, filterScenario, search, sortField, sortDir]);

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  }

  const thClass = "px-3 py-2.5 text-left text-xs font-medium text-slate-400 whitespace-nowrap select-none";
  const thSortClass = `${thClass} cursor-pointer hover:text-slate-200 transition-colors`;

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden flex flex-col min-h-0">
      {/* 工具列 */}
      <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-800/80 flex flex-wrap items-center gap-2">
        <div className="w-7 h-7 bg-indigo-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <Activity className="w-3.5 h-3.5 text-indigo-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-white">通話紀錄</h2>
          <p className="text-xs text-slate-400">Session History · {filtered.length} / {sessions.length} 筆</p>
        </div>
        {/* 搜尋 */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="搜尋 ID / 情境 / 意圖…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-slate-900/60 text-slate-300 placeholder-slate-600 text-xs rounded-lg pl-8 pr-3 py-1.5 border border-slate-700/50 focus:outline-none focus:border-indigo-500/50 w-48"
          />
        </div>
        {/* 模式篩選 */}
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
          <select
            value={filterMode}
            onChange={e => setFilterMode(e.target.value)}
            className="bg-slate-900/60 text-slate-300 text-xs rounded-lg px-2 py-1.5 border border-slate-700/50 focus:outline-none focus:border-indigo-500/50 cursor-pointer"
          >
            <option value="all">全部模式</option>
            <option value="gemini">Gemini Live</option>
            <option value="rest-ws">WS Live</option>
            <option value="legacy">Legacy</option>
          </select>
        </div>
        {/* 情境篩選 */}
        <select
          value={filterScenario}
          onChange={e => setFilterScenario(e.target.value)}
          className="bg-slate-900/60 text-slate-300 text-xs rounded-lg px-2 py-1.5 border border-slate-700/50 focus:outline-none focus:border-indigo-500/50 cursor-pointer"
        >
          <option value="all">全部情境</option>
          {scenarioOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* 表格 */}
      <div className="overflow-auto flex-1">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-slate-800/95 backdrop-blur">
            <tr className="border-b border-slate-700/70">
              <th className={thSortClass} onClick={() => toggleSort('startTime')}>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />時間
                  <SortIcon field="startTime" sortField={sortField} sortDir={sortDir} />
                </div>
              </th>
              <th className={thClass}>模式</th>
              <th className={thClass}>情境</th>
              <th className={thSortClass} onClick={() => toggleSort('turnCount')}>
                <div className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />輪次
                  <SortIcon field="turnCount" sortField={sortField} sortDir={sortDir} />
                </div>
              </th>
              <th className={thSortClass} onClick={() => toggleSort('avgLatency')}>
                <div className="flex items-center gap-1">
                  延遲<SortIcon field="avgLatency" sortField={sortField} sortDir={sortDir} />
                </div>
              </th>
              <th className={thClass}>意圖</th>
              <th className={thClass}>工單</th>
              <th className={thSortClass} onClick={() => toggleSort('duration')}>
                <div className="flex items-center gap-1">
                  時長<SortIcon field="duration" sortField={sortField} sortDir={sortDir} />
                </div>
              </th>
              <th className={thClass} />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-slate-500 text-sm">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>沒有符合條件的紀錄</p>
                </td>
              </tr>
            ) : (
              filtered.map((session, idx) => {
                const mode = session.mode || inferMode(session.sessionId);
                const scenarioName = session.scenarioName || session.scenarioId || '—';
                return (
                  <tr
                    key={session.filename || session.sessionId || idx}
                    className="border-b border-slate-700/30 hover:bg-slate-700/30 transition-colors cursor-pointer group"
                    onClick={() => onSelect(session)}
                  >
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-slate-300 font-mono">{formatTime(session.startTime)}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <ModeBadge mode={mode} />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-slate-200 font-medium">{scenarioName}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-xs text-slate-300">{session.turnCount ?? '—'}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <LatencyBadge ms={session.avgLatency} />
                    </td>
                    <td className="px-3 py-2.5">
                      <IntentTags intents={session.intents} />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {session.ticketCount > 0
                        ? <span className="px-1.5 py-0.5 bg-amber-500/15 text-amber-300 rounded text-xs">{session.ticketCount}</span>
                        : <span className="text-slate-600 text-xs">—</span>
                      }
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-slate-400">{formatDuration(session.duration)}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <ExternalLink className="w-3.5 h-3.5 text-slate-600 group-hover:text-indigo-400 transition-colors" />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
