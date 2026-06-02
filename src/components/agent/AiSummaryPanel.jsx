import React from 'react';
import { Sparkles, ArrowRight, CheckCircle } from 'lucide-react';

const emotionLabels = {
  neutral: { text: '平靜', color: 'text-slate-400' },
  satisfied: { text: '滿意', color: 'text-emerald-400' },
  frustrated: { text: '不耐煩', color: 'text-amber-400' },
  angry: { text: '生氣', color: 'text-red-400' },
  confused: { text: '困惑', color: 'text-orange-400' }
};

export default function AiSummaryPanel({ summary }) {
  if (!summary) return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-indigo-400" />
        <h4 className="text-sm font-medium text-slate-200">AI 摘要</h4>
      </div>
      <div className="text-xs text-slate-500">通話開始後將自動產生摘要...</div>
    </div>
  );

  const emotion = emotionLabels[summary.emotionState] || emotionLabels.neutral;

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-indigo-400" />
        <h4 className="text-sm font-medium text-slate-200">AI 摘要</h4>
        <span className={`ml-auto text-xs ${emotion.color}`}>{emotion.text}</span>
      </div>

      <p className="text-sm text-slate-300 mb-3">{summary.summary}</p>

      <div className="space-y-2">
        <div>
          <div className="text-xs text-slate-400 mb-1">主要問題</div>
          <div className="text-sm text-white">{summary.mainIssue}</div>
        </div>

        {summary.completedSteps && summary.completedSteps.length > 0 && (
          <div>
            <div className="text-xs text-slate-400 mb-1">已完成</div>
            <div className="space-y-1">
              {summary.completedSteps.map((step, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-emerald-300">
                  <CheckCircle className="w-3 h-3" />
                  {step}
                </div>
              ))}
            </div>
          </div>
        )}

        {summary.nextAction && (
          <div>
            <div className="text-xs text-slate-400 mb-1">下一步</div>
            <div className="flex items-center gap-1.5 text-sm text-indigo-300">
              <ArrowRight className="w-3.5 h-3.5" />
              {summary.nextAction}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
