// Mode Switch Component - Toggle between Mock, REST Live, and Gemini Live modes
import { Radio, Wifi, Sparkles } from 'lucide-react';

const MODES = [
  {
    id: 'mock',
    label: '演示',
    shortLabel: 'Demo',
    icon: Radio,
    color: 'indigo',
    description: '使用預設腳本進行展示，無需連接後端服務。'
  },
  {
    id: 'rest-live',
    label: 'WS Live',
    shortLabel: 'WS',
    icon: Wifi,
    color: 'green',
    description: '自定義後端 WebSocket 串流模式，後端負責 VAD + ASR→LLM→TTS。'
  },
  {
    id: 'gemini-live',
    label: 'Gemini',
    shortLabel: 'Gemini',
    icon: Sparkles,
    color: 'purple',
    description: 'Gemini Live 端到端即時語音。',
    experimental: true
  }
];

export function ModeSwitch({
  voiceMode,
  onModeChange,
  disabled = false,
  connectionStatus = 'disconnected',
  geminiConnectionStatus = 'disconnected',
  compact = false
}) {
  // Connection status indicator
  const getConnectionIndicator = () => {
    if (voiceMode === 'mock') return null;

    const status = voiceMode === 'gemini-live' ? geminiConnectionStatus : connectionStatus;

    switch (status) {
      case 'connected':
        return (
          <span className="flex items-center gap-1 text-green-400 text-xs">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            已連線
          </span>
        );
      case 'connecting':
        return (
          <span className="flex items-center gap-1 text-yellow-400 text-xs">
            <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />
            連線中
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-1 text-red-400 text-xs">
            <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
            連線失敗
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-slate-500 text-xs">
            <span className="w-1.5 h-1.5 bg-slate-500 rounded-full" />
            未連線
          </span>
        );
    }
  };

  const getColorClasses = (modeId, isActive) => {
    const colors = {
      'mock': {
        active: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50',
        inactive: 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 border-transparent'
      },
      'rest-live': {
        active: 'bg-green-500/20 text-green-400 border-green-500/50',
        inactive: 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 border-transparent'
      },
      'gemini-live': {
        active: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
        inactive: 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 border-transparent'
      }
    };
    return colors[modeId]?.[isActive ? 'active' : 'inactive'] || colors['mock'].inactive;
  };

  if (compact) {
    // Compact version - dropdown or single button showing current mode
    return (
      <div className="flex items-center gap-2">
        {MODES.map(mode => {
          const Icon = mode.icon;
          const isActive = voiceMode === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => !disabled && onModeChange(mode.id)}
              disabled={disabled}
              className={`
                flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                transition-all duration-200 border
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                ${getColorClasses(mode.id, isActive)}
              `}
              title={disabled ? '通話中無法切換模式' : mode.description}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{mode.shortLabel}</span>
              {mode.experimental && isActive && (
                <span className="text-[10px] bg-purple-500/30 px-1 rounded">實驗</span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Full version with all mode buttons
  return (
    <div className={`flex flex-col gap-2 ${disabled ? 'opacity-60' : ''}`}>
      {/* Mode buttons */}
      <div className="flex items-center gap-2">
        {MODES.map(mode => {
          const Icon = mode.icon;
          const isActive = voiceMode === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => !disabled && onModeChange(mode.id)}
              disabled={disabled}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                transition-all duration-200 border
                ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
                ${getColorClasses(mode.id, isActive)}
              `}
              title={disabled ? '通話中無法切換模式' : mode.description}
            >
              <Icon className="w-4 h-4" />
              <span>{mode.label}</span>
              {mode.experimental && (
                <span className="text-[10px] bg-purple-500/30 px-1.5 py-0.5 rounded">實驗</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Connection Status */}
      <div className="flex items-center gap-2">
        {getConnectionIndicator()}
      </div>
    </div>
  );
}

// Tooltip component for mode explanation
export function ModeSwitchTooltip({ voiceMode }) {
  const mode = MODES.find(m => m.id === voiceMode) || MODES[0];
  const Icon = mode.icon;

  const colorClasses = {
    'mock': 'text-indigo-400',
    'rest-live': 'text-green-400',
    'gemini-live': 'text-purple-400'
  };

  return (
    <div className="p-3 bg-slate-800 rounded-lg border border-slate-700 text-sm max-w-xs">
      <div className={`font-medium ${colorClasses[voiceMode]} mb-1 flex items-center gap-2`}>
        <Icon className="w-4 h-4" />
        {mode.label}模式
        {mode.experimental && (
          <span className="text-[10px] bg-purple-500/30 px-1.5 py-0.5 rounded">實驗</span>
        )}
      </div>
      <div className="text-slate-400">
        {mode.description}
      </div>
    </div>
  );
}

export default ModeSwitch;
