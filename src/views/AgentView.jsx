import React, { useRef, useEffect } from 'react';
import {
  Headphones, Phone, PhoneOff, Mic, MicOff, User, Bot, Brain, FileText,
  AlertTriangle, CheckCircle, XCircle, Info, Activity, Clock, ArrowRight,
  Building2, UtensilsCrossed, Stethoscope, Truck, Volume2, Pause, Play, Settings, MessageSquare,
  Radio, Wifi, Sparkles, AlertCircle, Loader2
} from 'lucide-react';
import { useCall } from '../context/CallContext';
import SystemLogPanel from '../components/SystemLogPanel';

// Icon 映射
const iconMap = {
  Building2,
  UtensilsCrossed,
  Stethoscope,
  Truck
};

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
    // 模式相關
    voiceMode,
    isProcessing,
    error,
    clearError,
    // Gemini Live 串流
    isStreaming,
    geminiConnectionStatus,
    // 播放相關
    isPlaying
  } = useCall();

  const chatContainerRef = useRef(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [displayedConversations]);

  // 選擇場景後自動撥號（客服視角：選擇即接聽）
  useEffect(() => {
    if (scenario && callState === 'idle') {
      dial();
    }
  }, [scenario, callState, dial]);

  // 模式顯示標籤
  const modeLabel = voiceMode === 'mock' ? '模擬' : voiceMode === 'rest-live' ? 'WS' : 'Gemini';

  const getFlagStyle = (flagType) => {
    switch (flagType) {
      case 'error': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'warning': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'success': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      default: return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* 頂部工具列 */}
      <div className="h-14 bg-slate-800 border-b border-slate-700 px-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 rounded-lg">
            <Headphones className="w-4 h-4 text-indigo-400" />
            <span className="text-sm text-white font-medium">客服值機台</span>
          </div>

          {scenario && (
            <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-700/50 rounded-lg">
              <div className={`w-8 h-8 bg-gradient-to-br ${scenario.gradientFrom} ${scenario.gradientTo} rounded-lg flex items-center justify-center`}>
                {React.createElement(iconMap[scenario.icon], { className: 'w-4 h-4 text-white' })}
              </div>
              <div>
                <div className="text-sm text-white font-medium">{scenario.name}</div>
                <div className="text-xs text-slate-400">{scenario.companyInfo.number}</div>
              </div>
            </div>
          )}

          {/* 模式標籤 */}
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            voiceMode === 'mock' ? 'bg-slate-600 text-slate-300' :
            voiceMode === 'rest-live' ? 'bg-cyan-500/20 text-cyan-300' :
            'bg-purple-500/20 text-purple-300'
          }`}>
            {modeLabel}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* 通話狀態 */}
          {callState === 'connected' && (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 rounded-lg">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-emerald-300 text-sm">通話中</span>
                <span className="text-emerald-400 font-mono text-sm">{formatDuration(callDuration)}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 rounded-lg">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span className="text-cyan-300 font-mono text-sm">{latencyMetrics.total}ms</span>
              </div>
            </>
          )}

          {callState === 'ended' && scenario && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 rounded-lg">
              <span className="text-slate-300 text-sm">通話結束</span>
              <span className="text-slate-400 font-mono text-sm">{formatDuration(callDuration)}</span>
            </div>
          )}

          {/* 通話控制 */}
          {callState === 'connected' && (
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                  isMuted ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <button
                onClick={hangUp}
                className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors cursor-pointer"
              >
                <PhoneOff className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 主要內容區 */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* 左側 - 來電選擇 / 對話區 */}
        <div className="w-1/2 min-h-0 flex flex-col border-r border-slate-700/50">
          {!scenario ? (
            // 等待來電畫面
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-6">
                <Phone className="w-12 h-12 text-slate-600" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">等待來電</h2>
              <p className="text-slate-400 text-sm mb-8">選擇模擬場景開始接聽</p>

              <div className="w-full max-w-md space-y-3">
                {Object.entries(scenarios).map(([key, s]) => {
                  const Icon = iconMap[s.icon];
                  return (
                    <button
                      key={key}
                      onClick={() => { selectScenario(key); }}
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
          ) : (
            // 對話區域
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* 對話標題 */}
              <div className="flex-shrink-0 px-4 py-3 border-b border-slate-700/50 flex items-center gap-2 bg-slate-800/50">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                <span className="text-sm text-white font-medium">即時對話</span>
                <span className="ml-auto text-xs text-slate-400">
                  {displayedConversations.length} 則
                </span>
              </div>

              {/* 對話內容 */}
              <div
                ref={chatContainerRef}
                className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3"
              >
                {displayedConversations.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-500">
                    <p className="text-sm">
                      {voiceMode === 'mock' ? '點擊「下一步」開始對話' :
                       voiceMode === 'rest-live' ? '開始說話，WS 後端即時回應' :
                       '開始說話，Gemini 即時回應'}
                    </p>
                  </div>
                ) : (
                  displayedConversations.map((conv, idx) => (
                    <div
                      key={conv.id || idx}
                      className={`flex gap-3 ${conv.speaker === 'customer' ? '' : 'flex-row-reverse'}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                        conv.speaker === 'customer' ? 'bg-slate-600' : 'bg-indigo-500'
                      }`}>
                        {conv.speaker === 'customer' ? (
                          <User className="w-4 h-4 text-slate-300" />
                        ) : (
                          <Bot className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <div className={`flex-1 max-w-[80%] ${conv.speaker === 'customer' ? '' : 'text-right'}`}>
                        <div className={`inline-block px-4 py-2.5 rounded-xl text-sm ${
                          conv.speaker === 'customer'
                            ? 'bg-slate-700 text-slate-100 text-left'
                            : 'bg-indigo-500 text-white text-left'
                        }`}>
                          {conv.text}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* 下方操作區 - 依模式不同 */}
              <div className="flex-shrink-0 p-4 border-t border-slate-700/50">
                {callState === 'connected' ? (
                  voiceMode === 'mock' ? (
                    /* Mock 模式 — 下一步按鈕 */
                    <button
                      onClick={nextStep}
                      className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <span>下一步對話</span>
                      <span className="text-indigo-200 text-sm">
                        ({conversationIndex + 2}/{scenario?.conversations.length})
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : voiceMode === 'rest-live' ? (
                    /* WS Live — 串流狀態（與 Gemini Live 相同操作模式） */
                    <div className="space-y-2">
                      <div className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 text-sm ${
                        isStreaming
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          : 'bg-slate-700/50 text-slate-400'
                      }`}>
                        {isStreaming ? (
                          <>
                            <Radio className="w-4 h-4 animate-pulse" />
                            <span>WS 對話串流中</span>
                            <Mic className="w-3 h-3 animate-pulse" />
                          </>
                        ) : (
                          <>
                            <Wifi className="w-4 h-4" />
                            <span>WS 連線就緒 — 直接語音對話</span>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Gemini Live — 串流狀態 */
                    <div className="space-y-2">
                      <div className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 text-sm ${
                        isStreaming
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-slate-700/50 text-slate-400'
                      }`}>
                        {isStreaming ? (
                          <>
                            <Sparkles className="w-4 h-4 animate-pulse" />
                            <span>Gemini 對話串流中</span>
                            <Radio className="w-3 h-3 animate-pulse" />
                          </>
                        ) : (
                          <>
                            <Wifi className="w-4 h-4" />
                            <span>Gemini 連線就緒 — 直接語音對話</span>
                          </>
                        )}
                      </div>
                    </div>
                  )
                ) : callState === 'ended' ? (
                  <button
                    onClick={goBack}
                    className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Phone className="w-4 h-4" />
                    <span>返回等待來電</span>
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* 右側 - AI 輔助面板 */}
        <div className="w-1/2 min-h-0 flex flex-col bg-slate-800/30 overflow-hidden">
          {/* AI 意圖分析 */}
          <div className="flex-shrink-0 p-4 border-b border-slate-700/50">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-white font-medium">AI 意圖分析</span>
            </div>

            {currentAnalysis ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1.5 bg-purple-500/20 text-purple-200 rounded-lg text-sm font-medium">
                    {currentAnalysis.intent}
                  </span>
                  <span className="text-sm text-slate-400">
                    信心度 {(currentAnalysis.confidence * 100).toFixed(0)}%
                  </span>
                </div>

                {currentAnalysis.entities.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {currentAnalysis.entities.map((entity, idx) => (
                      <span key={idx} className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs">
                        {entity}
                      </span>
                    ))}
                  </div>
                )}

                {currentAnalysis.flags?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {currentAnalysis.flags.map((flag, idx) => (
                      <span
                        key={idx}
                        className={`px-2 py-1 rounded text-xs border ${getFlagStyle(currentAnalysis.flagTypes?.[idx])}`}
                      >
                        {flag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-slate-500 text-sm py-4">
                等待客戶發話...
              </div>
            )}
          </div>

          {/* 產生的單據 */}
          <div className="flex-1 overflow-y-auto p-4 border-b border-slate-700/50">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-white font-medium">產生單據</span>
              {tickets.length > 0 && (
                <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-xs">
                  {tickets.length}
                </span>
              )}
            </div>

            {tickets.length === 0 ? (
              <div className="text-center text-slate-500 text-sm py-8">
                尚無單據產生
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map((ticket, idx) => (
                  <div key={ticket.id || idx} className="p-3 bg-slate-700/30 rounded-xl border border-slate-600/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-emerald-300 font-medium text-sm">{ticket.type}</span>
                      <span className="text-xs text-slate-400 font-mono">{ticket.ticketId}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {Object.entries(ticket).slice(0, 6).map(([key, value]) => {
                        if (['type', 'ticketId', 'id'].includes(key)) return null;
                        return (
                          <div key={key}>
                            <span className="text-slate-500">{key}: </span>
                            <span className="text-slate-300">{value}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 系統 Log */}
          <div className="flex-shrink-0">
            <SystemLogPanel maxHeight="h-36" />
          </div>
        </div>
      </div>
    </div>
  );
}
