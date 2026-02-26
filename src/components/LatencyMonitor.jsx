import { Activity, Mic, Brain, Volume2, Clock, Sparkles } from 'lucide-react';
import { useCall } from '../context/CallContext';

export default function LatencyMonitor() {
  const { latencyMetrics, callState, voiceMode } = useCall();
  const isGeminiMode = voiceMode === 'gemini-live';

  const getLatencyColor = (ms) => {
    if (ms === 0) return 'text-slate-500';
    if (ms < 300) return 'text-emerald-400';
    if (ms < 600) return 'text-amber-400';
    return 'text-red-400';
  };

  const getLatencyBg = (ms) => {
    if (ms === 0) return 'bg-slate-700';
    if (ms < 300) return 'bg-emerald-500';
    if (ms < 600) return 'bg-amber-500';
    return 'bg-red-500';
  };

  // Gemini 模式使用端到端延遲，REST 模式使用分段延遲
  const metrics = isGeminiMode
    ? [
        { key: 'e2e', label: 'E2E', icon: Sparkles, value: latencyMetrics.e2e || latencyMetrics.total, max: 1000 }
      ]
    : [
        { key: 'asr', label: 'ASR', icon: Mic, value: latencyMetrics.asr, max: 500 },
        { key: 'llm', label: 'LLM', icon: Brain, value: latencyMetrics.llm, max: 1200 },
        { key: 'tts', label: 'TTS', icon: Volume2, value: latencyMetrics.tts, max: 300 }
      ];

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden">
      {/* 標題列 */}
      <div className="px-4 py-3 border-b border-slate-700/50 flex items-center gap-2 bg-slate-800/80">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          isGeminiMode ? 'bg-purple-500/20' : 'bg-cyan-500/20'
        }`}>
          {isGeminiMode
            ? <Sparkles className="w-4 h-4 text-purple-400" />
            : <Activity className="w-4 h-4 text-cyan-400" />
          }
        </div>
        <div>
          <h2 className="font-semibold text-white text-sm">延遲監控</h2>
          <p className="text-xs text-slate-400">
            {isGeminiMode ? 'Gemini Live E2E' : 'Latency Monitor'}
          </p>
        </div>
        {/* 總延遲 */}
        <div className="ml-auto flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          <span className={`text-lg font-mono font-bold ${getLatencyColor(latencyMetrics.total)}`}>
            {latencyMetrics.total > 0 ? `${latencyMetrics.total}ms` : '---'}
          </span>
        </div>
      </div>

      {/* 指標區 */}
      <div className="p-4">
        {callState !== 'connected' ? (
          <div className="text-center text-slate-500 text-sm py-4">
            等待通話開始...
          </div>
        ) : (
          <div className="space-y-4">
            {metrics.map(({ key, label, icon: Icon, value, max }) => (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-slate-400" />
                    <span className="text-xs text-slate-400">{label}</span>
                  </div>
                  <span className={`text-sm font-mono ${getLatencyColor(value)}`}>
                    {value > 0 ? `${value}ms` : '---'}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${getLatencyBg(value)}`}
                    style={{ width: `${Math.min((value / max) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}

            {/* 狀態指示 */}
            <div className="pt-2 border-t border-slate-700/50">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">整體延遲狀態</span>
                <span className={`px-2 py-0.5 rounded ${
                  latencyMetrics.total === 0
                    ? 'bg-slate-700 text-slate-400'
                    : latencyMetrics.total < 1000
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : latencyMetrics.total < 1500
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-red-500/20 text-red-300'
                }`}>
                  {latencyMetrics.total === 0
                    ? '待測量'
                    : latencyMetrics.total < 1000
                    ? '優良'
                    : latencyMetrics.total < 1500
                    ? '正常'
                    : '需優化'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
