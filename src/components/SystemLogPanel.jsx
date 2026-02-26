import React, { useRef, useEffect } from 'react';
import { Terminal, AlertCircle, CheckCircle, Info, AlertTriangle, Bot, Settings } from 'lucide-react';
import { useCall } from '../context/CallContext';

// Log 類型樣式
const logStyles = {
  success: {
    color: 'text-emerald-400',
    icon: CheckCircle
  },
  error: {
    color: 'text-red-400',
    icon: AlertCircle
  },
  warning: {
    color: 'text-amber-400',
    icon: AlertTriangle
  },
  ai: {
    color: 'text-purple-400',
    icon: Bot
  },
  system: {
    color: 'text-cyan-400',
    icon: Settings
  },
  info: {
    color: 'text-slate-400',
    icon: Info
  }
};

export default function SystemLogPanel({ maxHeight = 'h-48' }) {
  const { systemLogs } = useCall();
  const logContainerRef = useRef(null);

  // 自動滾動到底部
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [systemLogs]);

  return (
    <div className={`${maxHeight} flex flex-col bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden font-mono`}>
      {/* 標題列 */}
      <div className="px-4 py-2 border-b border-slate-800 flex items-center gap-2 bg-slate-900">
        <Terminal className="w-4 h-4 text-slate-500" />
        <span className="text-sm text-slate-400">System Log</span>
        <div className="ml-auto flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/50" />
          <div className="w-3 h-3 rounded-full bg-amber-500/50" />
          <div className="w-3 h-3 rounded-full bg-emerald-500/50" />
        </div>
      </div>

      {/* Log 內容 */}
      <div
        ref={logContainerRef}
        className="flex-1 overflow-y-auto p-3 text-xs space-y-1"
      >
        {systemLogs.length === 0 ? (
          <div className="text-slate-600 flex items-center gap-2">
            <span className="text-slate-700">[--:--:--]</span>
            <span>等待系統事件...</span>
          </div>
        ) : (
          systemLogs.map((log, idx) => {
            const style = logStyles[log.type] || logStyles.info;
            const Icon = style.icon;
            return (
              <div
                key={log.id || idx}
                className={`flex items-start gap-2 ${style.color}`}
              >
                <span className="text-slate-600 flex-shrink-0">
                  [{log.timestamp}]
                </span>
                <Icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 opacity-70" />
                <span className="break-all">{log.message}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
