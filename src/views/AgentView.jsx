import React, { useEffect } from 'react';
import {
  Headphones, Phone, PhoneOff, Mic, MicOff, ArrowRight,
  Building2, UtensilsCrossed, Stethoscope, Truck, Activity,
  Radio, Wifi, Sparkles, PhoneForwarded
} from 'lucide-react';
import { useCall } from '../context/CallContext';
import TranscriptPanel from '../components/agent/TranscriptPanel';
import CustomerInfoCard from '../components/agent/CustomerInfoCard';
import IntentAnalysisCard from '../components/agent/IntentAnalysisCard';
import TicketCard from '../components/agent/TicketCard';
import AiSummaryPanel from '../components/agent/AiSummaryPanel';
import SuggestedResponseCard from '../components/agent/SuggestedResponseCard';
import QuickQueryPanel from '../components/agent/QuickQueryPanel';
import HandoffOverlay from '../components/agent/HandoffOverlay';

const iconMap = { Building2, UtensilsCrossed, Stethoscope, Truck };

export default function AgentView() {
  const {
    scenario,
    scenarios,
    callState,
    callDuration,
    isMuted,
    displayedConversations,
    conversationIndex,
    currentAnalysis,
    tickets,
    latencyMetrics,
    selectScenario,
    dial,
    hangUp,
    goBack,
    toggleMute,
    nextStep,
    formatDuration,
    voiceMode,
    isStreaming,
    streamingAiText,
    currentSummary,
    suggestedResponse,
    handoffPackage,
    isHandoffMode,
    generateHandoff,
    cancelHandoff,
    confirmHandoff,
  } = useCall();

  // 選擇場景後自動撥號
  useEffect(() => {
    if (scenario && callState === 'idle') {
      dial();
    }
  }, [scenario, callState, dial]);

  const modeLabel = voiceMode === 'mock' ? '模擬' : voiceMode === 'rest-live' ? 'WS' : 'Gemini';

  // 閒置狀態 — 場景選擇
  if (!scenario) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-900 p-8">
        <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6">
          <Phone className="w-10 h-10 text-slate-600" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">等待來電</h2>
        <p className="text-slate-400 text-sm mb-8">選擇模擬場景開始接聽</p>
        <div className="w-full max-w-md space-y-3">
          {Object.entries(scenarios).map(([key, s]) => {
            const Icon = iconMap[s.icon];
            return (
              <button
                key={key}
                onClick={() => selectScenario(key)}
                className={`w-full p-4 rounded-xl ${s.bgLight} hover:scale-[1.01] transition-all flex items-center gap-4 cursor-pointer border border-white/5`}
              >
                <div className={`w-12 h-12 bg-gradient-to-br ${s.gradientFrom} ${s.gradientTo} rounded-xl flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="text-left flex-1">
                  <div className="font-semibold text-white">{s.name}</div>
                  <div className="text-xs text-slate-400">{s.companyInfo.service}</div>
                </div>
                <Phone className="w-5 h-5 text-emerald-400" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-900 relative">
      {/* Handoff overlay */}
      <HandoffOverlay
        handoffPackage={handoffPackage}
        onConfirm={confirmHandoff}
        onCancel={cancelHandoff}
      />

      {/* 頂部工具列 */}
      <div className="h-14 bg-slate-800 border-b border-slate-700 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 rounded-lg">
            <Headphones className="w-4 h-4 text-indigo-400" />
            <span className="text-sm text-white font-medium">值機台</span>
          </div>
          {scenario && (
            <div className="flex items-center gap-2 px-2 py-1 bg-slate-700/50 rounded-lg">
              <div className={`w-6 h-6 bg-gradient-to-br ${scenario.gradientFrom} ${scenario.gradientTo} rounded flex items-center justify-center`}>
                {React.createElement(iconMap[scenario.icon], { className: 'w-3 h-3 text-white' })}
              </div>
              <span className="text-xs text-slate-300">{scenario.name}</span>
            </div>
          )}
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            voiceMode === 'mock' ? 'bg-slate-600 text-slate-300' :
            voiceMode === 'rest-live' ? 'bg-cyan-500/20 text-cyan-300' :
            'bg-purple-500/20 text-purple-300'
          }`}>{modeLabel}</span>
        </div>

        <div className="flex items-center gap-3">
          {callState === 'connected' && (
            <>
              <div className="flex items-center gap-2 px-2 py-1 bg-emerald-500/20 rounded-lg">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-emerald-300 text-xs font-mono">{formatDuration(callDuration)}</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 bg-slate-700 rounded-lg">
                <Activity className="w-3 h-3 text-cyan-400" />
                <span className="text-cyan-300 font-mono text-xs">{latencyMetrics.total || latencyMetrics.ttfc || '-'}ms</span>
              </div>
              <button onClick={toggleMute} className={`p-1.5 rounded-lg ${isMuted ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <button onClick={generateHandoff} className="p-1.5 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 rounded-lg" title="轉接真人">
                <PhoneForwarded className="w-4 h-4" />
              </button>
              <button onClick={hangUp} className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg">
                <PhoneOff className="w-4 h-4" />
              </button>
            </>
          )}
          {callState === 'ended' && (
            <button onClick={goBack} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs">
              返回等待
            </button>
          )}
        </div>
      </div>

      {/* 三欄主體 */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* 左欄 — 即時對話 */}
        <div className="w-[30%] min-h-0 border-r border-slate-700/50 flex flex-col">
          <div className="flex-1 min-h-0">
            <TranscriptPanel
              conversations={displayedConversations}
              streamingAiText={streamingAiText}
              isStreaming={isStreaming}
            />
          </div>
          {/* 底部操作 */}
          <div className="shrink-0 p-3 border-t border-slate-700/50">
            {callState === 'connected' && voiceMode === 'mock' ? (
              <button
                onClick={nextStep}
                className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
              >
                下一步 ({conversationIndex + 2}/{scenario?.conversations.length})
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : callState === 'connected' ? (
              <div className={`w-full py-2 rounded-lg flex items-center justify-center gap-2 text-xs ${
                isStreaming ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-slate-700/50 text-slate-400'
              }`}>
                {isStreaming ? <><Sparkles className="w-3 h-3 animate-pulse" />串流中</> : <><Wifi className="w-3 h-3" />連線就緒</>}
              </div>
            ) : null}
          </div>
        </div>

        {/* 中欄 — 客戶資訊、意圖分析、工單 */}
        <div className="w-[35%] min-h-0 overflow-y-auto p-4 space-y-4 border-r border-slate-700/50">
          <CustomerInfoCard analysis={currentAnalysis} scenario={scenario} />
          <IntentAnalysisCard analysis={currentAnalysis} />
          <TicketCard tickets={tickets} />
        </div>

        {/* 右欄 — AI 摘要、建議回覆、快速查詢 */}
        <div className="w-[35%] min-h-0 overflow-y-auto p-4 space-y-4">
          <AiSummaryPanel summary={currentSummary} />
          <SuggestedResponseCard suggestedResponse={suggestedResponse} />
          <QuickQueryPanel queries={scenario?.customerProfile?.queries} />
        </div>
      </div>
    </div>
  );
}
