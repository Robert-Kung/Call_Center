// RestWsPanel - REST WebSocket 模式狀態面板
import { Wifi, Zap } from 'lucide-react';
import { useCall } from '../context/CallContext';
import { REST_WS_CONFIG } from '../config/api';

export function RestWsPanel() {
  const {
    voiceMode,
    connectionStatus,
    latencyMetrics,
    callState
  } = useCall();

  // 只在 REST WS 模式時顯示
  if (voiceMode !== 'rest-live') {
    return null;
  }

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':    return 'text-green-400';
      case 'connecting':   return 'text-yellow-400';
      case 'error':        return 'text-red-400';
      default:             return 'text-slate-500';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':    return '已連線';
      case 'connecting':   return '連線中...';
      case 'error':        return '連線失敗';
      default:             return '未連線';
    }
  };

  const getDotClass = () => {
    switch (connectionStatus) {
      case 'connected':  return 'bg-green-400 animate-pulse';
      case 'connecting': return 'bg-yellow-400 animate-pulse';
      case 'error':      return 'bg-red-400';
      default:           return 'bg-slate-500';
    }
  };

  const getLatencyColor = (value, stage) => {
    if (!value) return 'text-slate-500';
    const thresholds = REST_WS_CONFIG.latencyThresholds[stage];
    if (!thresholds) return 'text-slate-400';
    if (value <= thresholds.good)     return 'text-green-400';
    if (value <= thresholds.warning)  return 'text-yellow-400';
    return 'text-red-400';
  };

  const stages = [
    { key: 'asr',   label: 'ASR' },
    { key: 'llm',   label: 'LLM' },
    { key: 'tts',   label: 'TTS' },
    { key: 'total', label: '合計' }
  ];

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-cyan-500/20">
      {/* 標題 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wifi className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-white">WebSocket Live</span>
          <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded">
            串流
          </span>
        </div>
        <div className={`flex items-center gap-1.5 text-xs ${getStatusColor()}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${getDotClass()}`} />
          {getStatusText()}
        </div>
      </div>

      {/* 延遲指標 */}
      <div className="grid grid-cols-4 gap-2">
        {stages.map(({ key, label }) => (
          <div key={key} className="bg-slate-900/50 rounded-lg p-2">
            <div className="flex items-center gap-1 text-slate-400 text-[10px] mb-1">
              <Zap className="w-2.5 h-2.5" />
              {label}
            </div>
            <div className={`text-sm font-mono font-semibold ${getLatencyColor(latencyMetrics[key], key)}`}>
              {latencyMetrics[key] ? `${latencyMetrics[key]}ms` : '--'}
            </div>
          </div>
        ))}
      </div>

      {/* 通話未開始時的提示 */}
      {callState === 'idle' && (
        <div className="mt-3 pt-3 border-t border-slate-700/50">
          <p className="text-xs text-slate-500 text-center">
            撥打電話以啟動 WebSocket 串流連線
          </p>
        </div>
      )}
    </div>
  );
}

export default RestWsPanel;
