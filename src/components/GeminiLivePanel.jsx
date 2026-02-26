// Gemini Live Panel - Display Gemini Live status and token usage
import { Sparkles, Zap, Coins } from 'lucide-react';
import { useCall } from '../context/CallContext';
import { GEMINI_CONFIG } from '../config/api';

export function GeminiLivePanel() {
  const {
    voiceMode,
    geminiConnectionStatus,
    geminiTokenUsage,
    latencyMetrics,
    callState
  } = useCall();

  // 只在 Gemini Live 模式且已連線時顯示
  if (voiceMode !== 'gemini-live') {
    return null;
  }

  const getStatusColor = () => {
    switch (geminiConnectionStatus) {
      case 'connected': return 'text-green-400';
      case 'connecting': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      default: return 'text-slate-500';
    }
  };

  const getStatusText = () => {
    switch (geminiConnectionStatus) {
      case 'connected': return '已連線';
      case 'connecting': return '連線中...';
      case 'error': return '連線失敗';
      default: return '未連線';
    }
  };

  const getLatencyColor = (latency) => {
    const thresholds = GEMINI_CONFIG.latencyThresholds.e2e;
    if (latency <= thresholds.good) return 'text-green-400';
    if (latency <= thresholds.warning) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-purple-500/20">
      {/* 標題 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-white">Gemini Live</span>
          <span className="text-[10px] bg-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded">
            實驗
          </span>
        </div>
        <div className={`flex items-center gap-1.5 text-xs ${getStatusColor()}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            geminiConnectionStatus === 'connected' ? 'bg-green-400 animate-pulse' :
            geminiConnectionStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' :
            geminiConnectionStatus === 'error' ? 'bg-red-400' : 'bg-slate-500'
          }`} />
          {getStatusText()}
        </div>
      </div>

      {/* 統計資訊 */}
      <div className="grid grid-cols-3 gap-3">
        {/* 端到端延遲 */}
        <div className="bg-slate-900/50 rounded-lg p-2.5">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
            <Zap className="w-3 h-3" />
            端到端延遲
          </div>
          <div className={`text-lg font-mono font-semibold ${
            latencyMetrics.e2e ? getLatencyColor(latencyMetrics.e2e) : 'text-slate-500'
          }`}>
            {latencyMetrics.e2e ? `${latencyMetrics.e2e}ms` : '--'}
          </div>
        </div>

        {/* Token 輸入 */}
        <div className="bg-slate-900/50 rounded-lg p-2.5">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
            <Coins className="w-3 h-3" />
            Token (入)
          </div>
          <div className="text-lg font-mono font-semibold text-blue-400">
            {geminiTokenUsage.input > 0 ? geminiTokenUsage.input.toLocaleString() : '--'}
          </div>
        </div>

        {/* Token 輸出 */}
        <div className="bg-slate-900/50 rounded-lg p-2.5">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
            <Coins className="w-3 h-3" />
            Token (出)
          </div>
          <div className="text-lg font-mono font-semibold text-purple-400">
            {geminiTokenUsage.output > 0 ? geminiTokenUsage.output.toLocaleString() : '--'}
          </div>
        </div>
      </div>

      {/* 總 Token 使用量 */}
      {geminiTokenUsage.total > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between text-xs">
          <span className="text-slate-400">總 Token 使用</span>
          <span className="font-mono text-white">
            {geminiTokenUsage.total.toLocaleString()}
          </span>
        </div>
      )}

      {/* 通話未開始時的提示 */}
      {callState === 'idle' && (
        <div className="mt-3 pt-3 border-t border-slate-700/50">
          <p className="text-xs text-slate-500 text-center">
            撥打電話以啟動 Gemini Live 連線
          </p>
        </div>
      )}
    </div>
  );
}

export default GeminiLivePanel;
