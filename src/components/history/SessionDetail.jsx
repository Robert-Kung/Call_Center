/**
 * SessionDetail.jsx
 * 單一 session 的完整詳細檢視頁
 */
import React, { useState } from 'react';
import {
  ArrowLeft, Clock, MessageSquare, Bot, User, Zap, FileText,
  ChevronDown, ChevronRight, Activity, Cpu, Timer, TrendingUp,
  AlertTriangle, CheckCircle, Tag, Phone, Calendar,
} from 'lucide-react';
import { MODE_CONFIG, inferMode, formatTime, formatDuration } from '../../services/SessionHistoryService';

// ── 事件類型設定 ─────────────────────────────────────────────────────────────
const EVENT_CONFIG = {
  session_start:         { label: '通話開始',    color: 'text-emerald-400', bg: 'bg-emerald-500/15', icon: Phone },
  session_end:           { label: '通話結束',    color: 'text-rose-400',    bg: 'bg-rose-500/15',    icon: Phone },
  turn_complete:         { label: '對話完成',    color: 'text-indigo-400',  bg: 'bg-indigo-500/15',  icon: MessageSquare },
  welcome:               { label: '歡迎訊息',    color: 'text-sky-400',     bg: 'bg-sky-500/15',     icon: Bot },
  input_transcript:      { label: '用戶語音',    color: 'text-blue-400',    bg: 'bg-blue-500/15',    icon: User },
  output_transcript:     { label: 'AI 語音',     color: 'text-purple-400',  bg: 'bg-purple-500/15',  icon: Bot },
  function_call:         { label: '函式呼叫',    color: 'text-amber-400',   bg: 'bg-amber-500/15',   icon: Zap },
  function_response:     { label: '函式回應',    color: 'text-amber-300',   bg: 'bg-amber-400/10',   icon: Zap },
  function_call_handled: { label: '函式完成',    color: 'text-amber-200',   bg: 'bg-amber-400/10',   icon: Zap },
  interrupted:           { label: '用戶打斷',    color: 'text-orange-400',  bg: 'bg-orange-500/15',  icon: AlertTriangle },
  audio_stats:           { label: '音訊統計',    color: 'text-slate-400',   bg: 'bg-slate-500/10',   icon: Activity },
  error:                 { label: '錯誤',        color: 'text-red-400',     bg: 'bg-red-500/15',     icon: AlertTriangle },
};

// ── 小工具 ───────────────────────────────────────────────────────────────────
function Section({ title, subtitle, icon: Icon, colorClass, children, collapsible = false }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      <div
        className={`px-4 py-3 border-b border-slate-700/50 bg-slate-800/80 flex items-center gap-2 ${collapsible ? 'cursor-pointer select-none hover:bg-slate-700/40 transition-colors' : ''}`}
        onClick={collapsible ? () => setOpen(o => !o) : undefined}
      >
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
        {collapsible && (
          open ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />
        )}
      </div>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

function LatencyBar({ value, max, label }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const color = value < 2000 ? 'bg-emerald-500' : value < 4000 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-slate-400 truncate max-w-[140px]" title={label}>{label}</span>
        <span className="text-xs font-mono font-medium text-slate-200">{value.toLocaleString()}ms</span>
      </div>
      <div className="h-2 bg-slate-700/60 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ChatBubble({ turn, idx }) {
  const hasUser = turn.userText?.trim();
  const hasAI = turn.aiText?.trim();
  return (
    <div className="space-y-2">
      {hasUser && (
        <div className="flex justify-end gap-2">
          <div className="max-w-[75%]">
            <div className="bg-indigo-600/60 text-white text-sm rounded-2xl rounded-tr-md px-4 py-2.5 leading-relaxed">
              {turn.userText}
            </div>
            <div className="flex justify-end items-center gap-1.5 mt-1 pr-1">
              <User className="w-3 h-3 text-slate-500" />
              <span className="text-xs text-slate-500">用戶</span>
            </div>
          </div>
        </div>
      )}
      {hasAI && (
        <div className="flex justify-start gap-2">
          <div className="max-w-[75%]">
            <div className="bg-slate-700/70 text-slate-100 text-sm rounded-2xl rounded-tl-md px-4 py-2.5 leading-relaxed border border-slate-600/40">
              {turn.aiText}
            </div>
            <div className="flex justify-start items-center gap-1.5 mt-1 pl-1 flex-wrap">
              <Bot className="w-3 h-3 text-purple-400" />
              <span className="text-xs text-slate-500">AI</span>
              {turn.latency != null && (
                <span className={`text-xs font-mono ${turn.latency < 2000 ? 'text-emerald-400' : turn.latency < 4000 ? 'text-amber-400' : 'text-red-400'}`}>
                  {turn.latency.toLocaleString()}ms
                </span>
              )}
              {turn.tokenUsage?.total != null && (
                <span className="text-xs text-slate-600">{turn.tokenUsage.total} tokens</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IntentCard({ event }) {
  const args = event.args || {};
  const confidence = args.confidence ?? 0;
  const pct = Math.round(confidence * 100);
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/40 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Tag className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
          <span className="text-sm font-semibold text-white">{args.intent || '未知意圖'}</span>
        </div>
        <span className="text-xs font-mono text-slate-400">{formatTime(event.timestamp)}</span>
      </div>
      {/* 信心度 */}
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-xs text-slate-500">信心度</span>
          <span className="text-xs font-medium text-slate-300">{pct}%</span>
        </div>
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      {/* 實體 */}
      {args.entities?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {args.entities.map((e, i) => (
            <span key={i} className="px-2 py-0.5 bg-indigo-500/15 text-indigo-300 rounded-full text-xs">{e}</span>
          ))}
        </div>
      )}
      {/* 警示旗 */}
      {args.flags?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {args.flags.map((f, i) => (
            <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-orange-500/15 text-orange-300 rounded-full text-xs">
              <AlertTriangle className="w-3 h-3" />{f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function TicketCard({ event }) {
  const args = event.args || {};
  const fields = [
    { label: '類型', value: args.type },
    { label: '摘要', value: args.summary },
    { label: '客戶姓名', value: args.customerName },
    { label: '聯絡電話', value: args.contactPhone },
    { label: '優先級', value: args.priority },
    { label: '狀態', value: args.status },
  ].filter(f => f.value);
  return (
    <div className="bg-slate-900/50 rounded-lg p-3 border border-amber-700/30 space-y-2">
      <div className="flex items-center gap-2">
        <CheckCircle className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-sm font-semibold text-white">工單已建立</span>
        <span className="ml-auto text-xs text-slate-500 font-mono">{formatTime(event.timestamp)}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {fields.map(f => (
          <div key={f.label}>
            <span className="text-xs text-slate-500">{f.label}：</span>
            <span className="text-xs text-slate-200">{f.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 主元件 ───────────────────────────────────────────────────────────────────
export default function SessionDetail({ summary, session, onBack }) {
  const mode = session?.sessionId ? inferMode(session.sessionId) : (summary?.mode || 'legacy');
  const modeCfg = MODE_CONFIG[mode] || MODE_CONFIG.legacy;

  // 從 events 提取各類資料
  const events = session?.events || [];
  const turns = events.filter(e => e.type === 'turn_complete');
  const intentEvents = events.filter(e => e.type === 'function_call' && e.name === 'analyze_intent');
  const ticketEvents = events.filter(e => e.type === 'function_call' && e.name === 'create_ticket');
  const welcomeEvent = events.find(e => e.type === 'welcome');

  // 對話：用 summary（已是逐輪整理好的）或 turn_complete events
  const chatSource = session?.summary?.length > 0 ? session.summary : turns.map(e => ({
    userText: e.userText, aiText: e.aiText, latency: e.latency, tokenUsage: e.tokenUsage,
  }));

  // 延遲統計
  const latencies = turns.map(e => e.latency).filter(v => v != null);
  const maxLatency = Math.max(...latencies, 1);
  const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;
  const minLatency = latencies.length > 0 ? Math.min(...latencies) : null;

  // 總 tokens
  const totalTokens = turns.reduce((s, e) => s + (e.tokenUsage?.total || 0), 0);

  // 事件時間線（排除 audio_stats 減少雜訊）
  const timelineEvents = events.filter(e => e.type !== 'audio_stats');

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      {/* 頂部 header */}
      <div className="flex-shrink-0 px-4 py-3 bg-slate-800/80 border-b border-slate-700/50 flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white text-xs rounded-lg transition-colors cursor-pointer flex-shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />返回列表
        </button>
        <div className="w-px h-6 bg-slate-700 flex-shrink-0" />
        {/* Session 基本資訊 */}
        <div className="flex items-center gap-3 min-w-0 flex-1 flex-wrap gap-y-1">
          <span className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${modeCfg.bg} ${modeCfg.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${modeCfg.dot}`} />
            {modeCfg.label}
          </span>
          <span className="text-sm font-semibold text-white truncate">{summary?.scenarioName || session?.scenarioName || '未知情境'}</span>
          <span className="text-xs text-slate-500 font-mono truncate">{session?.sessionId || summary?.sessionId}</span>
          <div className="flex items-center gap-3 ml-auto flex-shrink-0">
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Calendar className="w-3 h-3" />{formatTime(session?.startTime || summary?.startTime)}
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Timer className="w-3 h-3" />{formatDuration(summary?.duration)}
            </div>
          </div>
        </div>
      </div>

      {/* 主內容 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* 延遲概覽 */}
        {latencies.length > 0 && (
          <Section title="延遲概覽" subtitle="Latency Overview" icon={TrendingUp} colorClass="bg-amber-500/20 text-amber-400">
            {/* 統計卡片 */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: '平均延遲', value: avgLatency, icon: Activity },
                { label: '最低延遲', value: minLatency, icon: TrendingUp },
                { label: '最高延遲', value: Math.max(...latencies), icon: AlertTriangle },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-slate-900/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500 mb-1">{label}</p>
                  <p className={`text-lg font-bold font-mono ${value < 2000 ? 'text-emerald-400' : value < 4000 ? 'text-amber-400' : 'text-red-400'}`}>
                    {value?.toLocaleString()}ms
                  </p>
                </div>
              ))}
            </div>
            {/* 逐輪延遲 bars */}
            <div className="space-y-2.5">
              {turns.map((turn, i) => (
                turn.latency != null && (
                  <LatencyBar
                    key={i}
                    value={turn.latency}
                    max={maxLatency}
                    label={turn.userText ? `第 ${i + 1} 輪：${turn.userText.slice(0, 30)}${turn.userText.length > 30 ? '…' : ''}` : `第 ${i + 1} 輪`}
                  />
                )
              ))}
            </div>
            {totalTokens > 0 && (
              <p className="text-xs text-slate-500 mt-3 text-right">
                <Cpu className="w-3 h-3 inline mr-1" />總 token 用量：{totalTokens.toLocaleString()}
              </p>
            )}
          </Section>
        )}

        {/* 歡迎訊息 */}
        {welcomeEvent?.aiText && (
          <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl px-4 py-3 flex items-start gap-2">
            <Bot className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-sky-400 font-medium mb-1">AI 開場白</p>
              <p className="text-sm text-slate-200 leading-relaxed">{welcomeEvent.aiText}</p>
            </div>
          </div>
        )}

        {/* 對話紀錄 */}
        <Section
          title="對話紀錄"
          subtitle={`Conversation · ${chatSource.length} 輪`}
          icon={MessageSquare}
          colorClass="bg-indigo-500/20 text-indigo-400"
        >
          {chatSource.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">無對話記錄</p>
          ) : (
            <div className="space-y-4">
              {chatSource.map((turn, i) => (
                <ChatBubble key={i} turn={turn} idx={i} />
              ))}
            </div>
          )}
        </Section>

        {/* 意圖分析 */}
        {intentEvents.length > 0 && (
          <Section
            title="意圖分析"
            subtitle={`Analyze Intent · ${intentEvents.length} 次`}
            icon={Zap}
            colorClass="bg-purple-500/20 text-purple-400"
          >
            <div className="space-y-3">
              {intentEvents.map((e, i) => <IntentCard key={i} event={e} />)}
            </div>
          </Section>
        )}

        {/* 工單紀錄 */}
        {ticketEvents.length > 0 && (
          <Section
            title="工單紀錄"
            subtitle={`Create Ticket · ${ticketEvents.length} 張`}
            icon={FileText}
            colorClass="bg-amber-500/20 text-amber-400"
          >
            <div className="space-y-3">
              {ticketEvents.map((e, i) => <TicketCard key={i} event={e} />)}
            </div>
          </Section>
        )}

        {/* 事件時間線（可收合） */}
        <Section
          title="事件時間線"
          subtitle={`Event Timeline · ${timelineEvents.length} 個事件`}
          icon={Activity}
          colorClass="bg-slate-500/20 text-slate-400"
          collapsible
        >
          <div className="relative space-y-1">
            {timelineEvents.map((event, i) => {
              const cfg = EVENT_CONFIG[event.type] || { label: event.type, color: 'text-slate-400', bg: 'bg-slate-500/10', icon: Activity };
              const Icon = cfg.icon;
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex-shrink-0 flex flex-col items-center">
                    <div className={`w-6 h-6 rounded-full ${cfg.bg} flex items-center justify-center`}>
                      <Icon className={`w-3 h-3 ${cfg.color}`} />
                    </div>
                    {i < timelineEvents.length - 1 && <div className="w-px h-3 bg-slate-700/50" />}
                  </div>
                  <div className="flex-1 min-w-0 pb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-xs text-slate-600 font-mono">{event.elapsed != null ? `+${(event.elapsed / 1000).toFixed(1)}s` : ''}</span>
                    </div>
                    {event.type === 'turn_complete' && event.userText && (
                      <p className="text-xs text-slate-500 truncate mt-0.5">👤 {event.userText.slice(0, 60)}</p>
                    )}
                    {event.type === 'function_call' && (
                      <p className="text-xs text-slate-500 font-mono mt-0.5">{event.name}({JSON.stringify(event.args || {}).slice(0, 60)})</p>
                    )}
                    {event.type === 'session_end' && (
                      <p className="text-xs text-slate-500 mt-0.5">共 {event.totalEvents} 個事件，{formatDuration(event.duration)}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      </div>
    </div>
  );
}
