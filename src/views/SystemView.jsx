import React, { useRef, useEffect, useMemo } from 'react';
import {
  Settings, Mic, Brain, Volume2, ArrowRight, Phone, PhoneOff,
  Activity, Clock, Database, Server, Cpu, MemoryStick, Zap,
  Building2, UtensilsCrossed, Hotel, CheckCircle, AlertTriangle,
  Sparkles, Wifi, Radio
} from 'lucide-react';
import { useCall } from '../context/CallContext';

// Icon 映射
const iconMap = {
  Building2,
  UtensilsCrossed,
  Hotel
};

// 流程步驟 — REST / Mock
const restPipelineSteps = [
  { id: 'input', label: '語音輸入', icon: Mic, color: 'cyan' },
  { id: 'asr', label: 'ASR', subLabel: 'Whisper', icon: Mic, color: 'blue' },
  { id: 'llm', label: 'LLM', subLabel: 'Claude', icon: Brain, color: 'purple' },
  { id: 'tts', label: 'TTS', subLabel: 'Azure', icon: Volume2, color: 'pink' },
  { id: 'output', label: '語音輸出', icon: Volume2, color: 'emerald' }
];

// 流程步驟 — Gemini Live（端到端）
const geminiPipelineSteps = [
  { id: 'input', label: '語音輸入', subLabel: '16kHz PCM', icon: Mic, color: 'cyan' },
  { id: 'gemini', label: 'Gemini', subLabel: 'E2E Multimodal', icon: Sparkles, color: 'purple' },
  { id: 'output', label: '語音輸出', subLabel: '24kHz PCM', icon: Volume2, color: 'emerald' }
];

export default function SystemView() {
  const {
    scenario,
    scenarios,
    callState,
    callDuration,
    displayedConversations,
    conversationIndex,
    latencyMetrics,
    systemLogs,
    selectScenario,
    dial,
    hangUp,
    goBack,
    nextStep,
    formatDuration,
    // 模式相關
    voiceMode,
    isProcessing,
    isStreaming,
    isPlaying,
    geminiConnectionStatus,
    geminiTokenUsage
  } = useCall();

  const pipelineSteps = useMemo(() =>
    voiceMode === 'gemini-live' ? geminiPipelineSteps : restPipelineSteps
  , [voiceMode]);

  const logContainerRef = useRef(null);
  const conversationContainerRef = useRef(null);

  // 自動滾動 Log 到底部
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [systemLogs]);

  // 自動滾動對話到底部
  useEffect(() => {
    if (conversationContainerRef.current) {
      conversationContainerRef.current.scrollTop = conversationContainerRef.current.scrollHeight;
    }
  }, [displayedConversations]);

  // 模擬系統指標
  const systemMetrics = {
    cpu: Math.floor(Math.random() * 30) + 10,
    memory: Math.floor(Math.random() * 20) + 40,
    connections: callState === 'connected' ? 1 : 0,
    uptime: '99.9%'
  };

  const getLatencyColor = (ms) => {
    if (ms === 0) return 'slate';
    if (ms < 300) return 'emerald';
    if (ms < 600) return 'amber';
    return 'red';
  };

  return (
    <div className="h-full flex flex-col bg-slate-950">
      {/* 頂部狀態列 */}
      <div className="h-12 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-white font-medium">系統監控視角</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>|</span>
            <span>Pipeline Monitor</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* 系統狀態指標 */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-400">CPU</span>
              <span className="text-cyan-400 font-mono">{systemMetrics.cpu}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MemoryStick className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-400">MEM</span>
              <span className="text-cyan-400 font-mono">{systemMetrics.memory}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-400">Uptime</span>
              <span className="text-emerald-400 font-mono">{systemMetrics.uptime}</span>
            </div>
          </div>

          {callState === 'connected' && (
            <button
              onClick={hangUp}
              className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm flex items-center gap-2 transition-colors cursor-pointer"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              結束通話
            </button>
          )}
        </div>
      </div>

      {/* 主要內容 */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* 左側 - Pipeline 視覺化 */}
        <div className="w-2/3 min-h-0 flex flex-col border-r border-slate-800">
          {/* Pipeline 流程圖 */}
          <div className="p-6 border-b border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-sm text-slate-400 font-medium">Processing Pipeline</h2>
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                  voiceMode === 'mock' ? 'bg-slate-700 text-slate-400' :
                  voiceMode === 'rest-live' ? 'bg-cyan-500/20 text-cyan-300' :
                  'bg-purple-500/20 text-purple-300'
                }`}>
                  {voiceMode === 'mock' ? 'MOCK' : voiceMode === 'rest-live' ? 'REST' : 'GEMINI'}
                </span>
              </div>
              {callState === 'connected' && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Total Latency:</span>
                  <span className={`font-mono text-${getLatencyColor(latencyMetrics.total)}-400`}>
                    {latencyMetrics.total}ms
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              {pipelineSteps.map((step, idx) => (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border-2 transition-all ${
                      callState === 'connected'
                        ? `bg-${step.color}-500/20 border-${step.color}-500/50`
                        : 'bg-slate-800 border-slate-700'
                    }`}>
                      <step.icon className={`w-7 h-7 ${
                        callState === 'connected' ? `text-${step.color}-400` : 'text-slate-500'
                      }`} />
                    </div>
                    <span className={`text-xs mt-2 font-medium ${
                      callState === 'connected' ? 'text-white' : 'text-slate-500'
                    }`}>
                      {step.label}
                    </span>
                    {step.subLabel && (
                      <span className="text-[10px] text-slate-500">{step.subLabel}</span>
                    )}
                    {/* 延遲指標 */}
                    {step.id === 'asr' && latencyMetrics.asr > 0 && (
                      <span className={`text-xs font-mono mt-1 text-${getLatencyColor(latencyMetrics.asr)}-400`}>
                        {latencyMetrics.asr}ms
                      </span>
                    )}
                    {step.id === 'llm' && latencyMetrics.llm > 0 && (
                      <span className={`text-xs font-mono mt-1 text-${getLatencyColor(latencyMetrics.llm)}-400`}>
                        {latencyMetrics.llm}ms
                      </span>
                    )}
                    {step.id === 'tts' && latencyMetrics.tts > 0 && (
                      <span className={`text-xs font-mono mt-1 text-${getLatencyColor(latencyMetrics.tts)}-400`}>
                        {latencyMetrics.tts}ms
                      </span>
                    )}
                    {step.id === 'gemini' && (latencyMetrics.ttfc > 0 || latencyMetrics.streamDuration > 0) && (
                      <span className={`text-xs font-mono mt-1 text-${getLatencyColor(latencyMetrics.e2e || latencyMetrics.total)}-400`}>
                        {latencyMetrics.ttfc > 0 ? `${latencyMetrics.ttfc}ms TTFC` : `${latencyMetrics.streamDuration}ms`}
                      </span>
                    )}
                  </div>
                  {idx < pipelineSteps.length - 1 && (
                    <ArrowRight className={`w-6 h-6 ${
                      callState === 'connected' ? 'text-slate-500' : 'text-slate-700'
                    }`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* 場景選擇或對話追蹤 */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {!scenario ? (
              // 場景選擇
              <div className="flex-1 flex flex-col items-center justify-center p-8">
                <Server className="w-16 h-16 text-slate-700 mb-4" />
                <h2 className="text-lg text-white mb-2">選擇測試場景</h2>
                <p className="text-sm text-slate-500 mb-6">開始模擬通話以查看系統處理流程</p>
                <div className="grid grid-cols-3 gap-4 w-full max-w-xl">
                  {Object.entries(scenarios).map(([key, s]) => {
                    const Icon = iconMap[s.icon];
                    return (
                      <button
                        key={key}
                        onClick={() => { selectScenario(key); dial(); }}
                        className="p-4 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-all cursor-pointer flex flex-col items-center gap-3"
                      >
                        <div className={`w-12 h-12 bg-gradient-to-br ${s.gradientFrom} ${s.gradientTo} rounded-xl flex items-center justify-center`}>
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-sm text-white font-medium">{s.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              // 對話追蹤
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex-shrink-0 px-4 py-2 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-400">對話追蹤</span>
                    {callState === 'ended' && (
                      <span className="px-2 py-0.5 bg-slate-700 text-slate-400 rounded text-xs">
                        已結束 - {formatDuration(callDuration)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">進度:</span>
                    <span className="text-slate-300">
                      {voiceMode === 'mock'
                        ? `${displayedConversations.length}/${scenario.conversations.length}`
                        : `${displayedConversations.length} turns`}
                    </span>
                  </div>
                </div>

                <div
                  ref={conversationContainerRef}
                  className="flex-1 min-h-0 overflow-y-auto p-4"
                >
                  <div className="space-y-2">
                    {displayedConversations.map((conv, idx) => (
                      <div
                        key={conv.id || idx}
                        className="p-3 bg-slate-900 rounded-lg border border-slate-800 font-mono text-xs"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`px-2 py-0.5 rounded ${
                            conv.speaker === 'customer' ? 'bg-slate-700 text-slate-300' : 'bg-indigo-500/20 text-indigo-300'
                          }`}>
                            {conv.speaker === 'customer' ? 'USER' : 'ASSISTANT'}
                          </span>
                          <span className="text-slate-600">turn_{idx + 1}</span>
                        </div>
                        <p className="text-slate-400 leading-relaxed">{conv.text}</p>
                        {conv.analysis && (
                          <div className="mt-2 pt-2 border-t border-slate-800">
                            <span className="text-purple-400">intent:</span>
                            <span className="text-slate-300 ml-2">{conv.analysis.intent}</span>
                            <span className="text-slate-600 ml-2">({(conv.analysis.confidence * 100).toFixed(0)}%)</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 下方控制 - 依模式不同 */}
                <div className="flex-shrink-0 p-4 border-t border-slate-800">
                  {callState === 'connected' ? (
                    voiceMode === 'mock' ? (
                      <button
                        onClick={nextStep}
                        className="w-full py-2.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer border border-indigo-500/30"
                      >
                        <Zap className="w-4 h-4" />
                        Execute Next Turn
                        <span className="text-indigo-400/60">({conversationIndex + 2}/{scenario.conversations.length})</span>
                      </button>
                    ) : voiceMode === 'rest-live' ? (
                      <div className={`w-full py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 border ${
                        isStreaming
                          ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300'
                          : 'bg-slate-800 border-slate-700 text-slate-500'
                      }`}>
                        {isStreaming ? (
                          <><Radio className="w-3 h-3 animate-pulse" /> WS Live Streaming Active</>
                        ) : (
                          <><Wifi className="w-3 h-3" /> WS Live Ready — Voice-Activated</>
                        )}
                      </div>
                    ) : (
                      <div className={`w-full py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 border ${
                        isStreaming
                          ? 'bg-purple-500/20 border-purple-500/30 text-purple-300'
                          : 'bg-slate-800 border-slate-700 text-slate-500'
                      }`}>
                        {isStreaming ? (
                          <><Radio className="w-3 h-3 animate-pulse" /> Gemini Streaming Active</>
                        ) : (
                          <><Wifi className="w-3 h-3" /> Gemini Ready — Voice-Activated</>
                        )}
                      </div>
                    )
                  ) : callState === 'ended' ? (
                    <button
                      onClick={goBack}
                      className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Server className="w-4 h-4" />
                      Reset Pipeline
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 右側 - 系統 Log */}
        <div className="w-1/3 min-h-0 flex flex-col bg-slate-900 overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-800 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            <span className="text-sm text-white font-medium">System Logs</span>
          </div>

          <div
            ref={logContainerRef}
            className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-1"
          >
            {systemLogs.length === 0 ? (
              <div className="text-slate-600">// Waiting for system events...</div>
            ) : (
              systemLogs.map((log, idx) => {
                const color = {
                  success: 'text-emerald-400',
                  error: 'text-red-400',
                  warning: 'text-amber-400',
                  ai: 'text-purple-400',
                  system: 'text-cyan-400',
                  info: 'text-slate-400'
                }[log.type] || 'text-slate-400';

                return (
                  <div key={log.id || idx} className={`${color} flex`}>
                    <span className="text-slate-600 flex-shrink-0 w-20">[{log.timestamp}]</span>
                    <span className="break-all">{log.message}</span>
                  </div>
                );
              })
            )}
          </div>

          {/* 延遲統計 */}
          {callState === 'connected' && voiceMode !== 'gemini-live' && (
            <div className="p-4 border-t border-slate-800 space-y-3">
              <div className="text-xs text-slate-500 mb-2">Latency Breakdown</div>
              {[
                { label: 'ASR (Whisper)', value: latencyMetrics.asr, max: 500 },
                { label: 'LLM (Claude)', value: latencyMetrics.llm, max: 1200 },
                { label: 'TTS (Azure)', value: latencyMetrics.tts, max: 300 }
              ].map(({ label, value, max }) => (
                <div key={label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">{label}</span>
                    <span className={`font-mono text-${getLatencyColor(value)}-400`}>
                      {value}ms
                    </span>
                  </div>
                  <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-${getLatencyColor(value)}-500 rounded-full transition-all`}
                      style={{ width: `${Math.min((value / max) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Gemini Live 統計 */}
          {callState === 'connected' && voiceMode === 'gemini-live' && (
            <div className="p-4 border-t border-slate-800 space-y-3">
              <div className="text-xs text-slate-500 mb-2">Gemini Live Stats</div>
              {/* 連線狀態 */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Connection</span>
                <span className={`font-medium ${
                  geminiConnectionStatus === 'connected' ? 'text-emerald-400' :
                  geminiConnectionStatus === 'connecting' ? 'text-amber-400' :
                  'text-slate-500'
                }`}>
                  {geminiConnectionStatus === 'connected' ? 'Active' :
                   geminiConnectionStatus === 'connecting' ? 'Connecting...' : 'Idle'}
                </span>
              </div>
              {/* 感知延遲 TTFC */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">TTFC (感知延遲)</span>
                  <span className={`font-mono text-${getLatencyColor(latencyMetrics.ttfc || 0)}-400`}>
                    {latencyMetrics.ttfc > 0 ? `${latencyMetrics.ttfc}ms` : '--'}
                  </span>
                </div>
                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-${getLatencyColor(latencyMetrics.ttfc || 0)}-500 rounded-full transition-all`}
                    style={{ width: `${latencyMetrics.ttfc > 0 ? Math.min((latencyMetrics.ttfc / 800) * 100, 100) : 0}%` }}
                  />
                </div>
              </div>
              {/* 串流時長 */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">串流時長</span>
                  <span className={`font-mono text-${getLatencyColor(latencyMetrics.streamDuration || 0)}-400`}>
                    {latencyMetrics.streamDuration > 0 ? `${latencyMetrics.streamDuration}ms` : '--'}
                  </span>
                </div>
                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-${getLatencyColor(latencyMetrics.streamDuration || 0)}-500 rounded-full transition-all`}
                    style={{ width: `${latencyMetrics.streamDuration > 0 ? Math.min((latencyMetrics.streamDuration / 2000) * 100, 100) : 0}%` }}
                  />
                </div>
              </div>
              {/* Token 使用 */}
              {geminiTokenUsage && (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Input Tokens</span>
                    <span className="text-purple-400 font-mono">{geminiTokenUsage.inputTokens || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Output Tokens</span>
                    <span className="text-purple-400 font-mono">{geminiTokenUsage.outputTokens || 0}</span>
                  </div>
                </>
              )}
              {/* 串流狀態 */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Streaming</span>
                <span className={isStreaming ? 'text-purple-400' : 'text-slate-600'}>
                  {isStreaming ? '● Active' : '○ Idle'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
