import React from 'react';
import PhoneSimulator from '../components/PhoneSimulator';
import ConversationPanel from '../components/ConversationPanel';
import AnalysisPanel from '../components/AnalysisPanel';
import TicketPanel from '../components/TicketPanel';
import SystemLogPanel from '../components/SystemLogPanel';
import LatencyMonitor from '../components/LatencyMonitor';
import GeminiLivePanel from '../components/GeminiLivePanel';
import RestWsPanel from '../components/RestWsPanel';
import { useCall } from '../context/CallContext';
import { Phone, Zap, Building2, UtensilsCrossed, Hotel } from 'lucide-react';

// Icon 映射
const iconMap = {
  Building2,
  UtensilsCrossed,
  Hotel
};

export default function DemoView() {
  const { scenario, callState, callDuration, formatDuration, voiceMode } = useCall();

  // WS Live 無 function call，隱藏意圖分析與工單面板
  const showFunctionCallPanels = voiceMode !== 'rest-live';
  // Gemini Live / WS Live 各有自己的延遲面板，避免重複
  const showLatencyMonitor = voiceMode === 'mock';

  return (
    <div className="h-full flex bg-slate-900">
      {/* 左側 - 手機模擬器區域 */}
      <div className="w-[380px] flex-shrink-0 flex items-center justify-center p-6 bg-gradient-to-br from-slate-800 to-slate-900 border-r border-slate-700/50">
        <div className="relative">
          {/* 背景光暈效果 */}
          {scenario && callState === 'connected' && (
            <div className={`absolute inset-0 bg-gradient-to-br ${scenario.gradientFrom} ${scenario.gradientTo} opacity-20 blur-3xl -z-10 scale-150`} />
          )}
          <PhoneSimulator />
        </div>
      </div>

      {/* 右側 - 儀錶板區域 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 頂部狀態列 */}
        <div className="h-14 bg-slate-800/50 border-b border-slate-700/50 px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {scenario ? (
              <>
                {/* 場景圖示 */}
                <div className={`w-10 h-10 bg-gradient-to-br ${scenario.gradientFrom} ${scenario.gradientTo} rounded-xl flex items-center justify-center`}>
                  {React.createElement(iconMap[scenario.icon], { className: 'w-5 h-5 text-white' })}
                </div>
                <div>
                  <h2 className="text-white font-semibold">{scenario.name}</h2>
                  <p className="text-xs text-slate-400">{scenario.companyInfo.service}</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center">
                  <Phone className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <h2 className="text-slate-400 font-semibold">等待選擇場景</h2>
                  <p className="text-xs text-slate-500">請在左側選擇撥打對象</p>
                </div>
              </>
            )}
          </div>

          {/* 狀態指示 */}
          <div className="flex items-center gap-4">
            {callState === 'connected' && (
              <>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 rounded-full">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-emerald-300 text-sm font-medium">通話中</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Zap className="w-4 h-4" />
                  <span className="font-mono">{formatDuration(callDuration)}</span>
                </div>
              </>
            )}
            {callState === 'ended' && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 rounded-full">
                <span className="text-slate-300 text-sm">通話結束</span>
              </div>
            )}
          </div>
        </div>

        {/* 主要儀錶板內容 */}
        <div className="flex-1 p-4 overflow-hidden">
          <div className="h-full grid grid-cols-2 gap-4">
            {/* 左欄 */}
            <div className="flex flex-col gap-4 overflow-hidden">
              {/* 對話逐字稿 */}
              <div className="flex-1 min-h-0">
                <ConversationPanel />
              </div>
            </div>

            {/* 右欄 */}
            <div className="flex flex-col gap-4 overflow-hidden">
              {/* 意圖分析（Mock / Gemini Live 才有 function call） */}
              {showFunctionCallPanels && (
                <div className="h-[240px] flex-shrink-0">
                  <AnalysisPanel />
                </div>
              )}

              {/* 產生單據（Mock / Gemini Live 才有 function call） */}
              {showFunctionCallPanels && (
                <div className="flex-1 min-h-0">
                  <TicketPanel />
                </div>
              )}

              {/* 延遲監控（Mock 模式專用；Live 模式各自面板已含延遲資訊） */}
              {showLatencyMonitor && (
                <div className="flex-shrink-0">
                  <LatencyMonitor />
                </div>
              )}

              {/* Gemini Live 面板（含連線狀態 + E2E 延遲 + token 用量） */}
              <GeminiLivePanel />

              {/* REST WS 面板（含連線狀態 + ASR/LLM/TTS 延遲） */}
              <RestWsPanel />

              {/* 系統 Log */}
              <div className="flex-shrink-0">
                <SystemLogPanel maxHeight="h-40" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
