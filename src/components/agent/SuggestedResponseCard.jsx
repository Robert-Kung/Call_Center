import React from 'react';
import { MessageSquare, Copy } from 'lucide-react';

export default function SuggestedResponseCard({ suggestedResponse }) {
  if (!suggestedResponse) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(suggestedResponse);
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-indigo-500/30 p-4">
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare className="w-4 h-4 text-indigo-400" />
        <h4 className="text-sm font-medium text-slate-200">建議回覆</h4>
        <button
          onClick={handleCopy}
          className="ml-auto p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 transition-colors"
          title="複製"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-sm text-indigo-200 leading-relaxed">{suggestedResponse}</p>
    </div>
  );
}
