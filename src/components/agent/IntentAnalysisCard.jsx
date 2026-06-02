import React from 'react';
import { Brain, AlertTriangle } from 'lucide-react';

export default function IntentAnalysisCard({ analysis }) {
  if (!analysis) return null;

  const confidenceColor = analysis.confidence >= 0.8 ? 'text-emerald-400' :
    analysis.confidence >= 0.6 ? 'text-amber-400' : 'text-red-400';

  const getFlagStyle = (flagType) => {
    switch (flagType) {
      case 'error': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'warning': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'success': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      default: return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Brain className="w-4 h-4 text-violet-400" />
        <h4 className="text-sm font-medium text-slate-200">意圖分析</h4>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-white font-medium">{analysis.intent}</span>
        <span className={`text-xs font-mono ${confidenceColor}`}>
          {Math.round(analysis.confidence * 100)}%
        </span>
      </div>

      {analysis.flags && analysis.flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {analysis.flags.map((flag, i) => (
            <span key={i} className={`px-2 py-0.5 rounded border text-xs ${getFlagStyle(analysis.flagTypes?.[i])}`}>
              {flag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
