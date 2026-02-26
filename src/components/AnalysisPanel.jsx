import React from 'react';
import { Brain, Target, Tag, AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';
import { useCall } from '../context/CallContext';

export default function AnalysisPanel() {
  const { currentAnalysis, callState } = useCall();

  const getFlagIcon = (flagType) => {
    switch (flagType) {
      case 'error':
        return <XCircle className="w-3 h-3" />;
      case 'warning':
        return <AlertTriangle className="w-3 h-3" />;
      case 'success':
        return <CheckCircle className="w-3 h-3" />;
      default:
        return <Info className="w-3 h-3" />;
    }
  };

  const getFlagStyle = (flagType) => {
    switch (flagType) {
      case 'error':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'warning':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'success':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      default:
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden">
      {/* 標題列 */}
      <div className="px-4 py-3 border-b border-slate-700/50 flex items-center gap-2 bg-slate-800/80">
        <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
          <Brain className="w-4 h-4 text-purple-400" />
        </div>
        <div>
          <h2 className="font-semibold text-white text-sm">AI 意圖分析</h2>
          <p className="text-xs text-slate-400">Intent Recognition</p>
        </div>
      </div>

      {/* 內容區 */}
      <div className="flex-1 overflow-y-auto p-4">
        {currentAnalysis ? (
          <div className="space-y-4">
            {/* 意圖識別 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Target className="w-3.5 h-3.5" />
                <span>識別意圖</span>
              </div>
              <div className="px-4 py-2.5 bg-purple-500/20 border border-purple-500/30 rounded-xl">
                <span className="text-purple-200 font-medium">
                  {currentAnalysis.intent}
                </span>
              </div>
            </div>

            {/* 信心度 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">信心度</span>
                <span className="text-white font-medium">
                  {(currentAnalysis.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${currentAnalysis.confidence * 100}%` }}
                />
              </div>
            </div>

            {/* 擷取實體 */}
            {currentAnalysis.entities.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Tag className="w-3.5 h-3.5" />
                  <span>擷取實體</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {currentAnalysis.entities.map((entity, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 bg-slate-700/50 text-slate-300 rounded-lg text-xs border border-slate-600/50"
                    >
                      {entity}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 注意標記 */}
            {currentAnalysis.flags && currentAnalysis.flags.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>注意標記</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {currentAnalysis.flags.map((flag, idx) => {
                    const flagType = currentAnalysis.flagTypes?.[idx] || 'info';
                    return (
                      <span
                        key={idx}
                        className={`px-2.5 py-1 rounded-lg text-xs border flex items-center gap-1.5 ${getFlagStyle(flagType)}`}
                      >
                        {getFlagIcon(flagType)}
                        {flag}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <Brain className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">
              {callState === 'connected' ? '等待客戶發話...' : '等待通話開始...'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
