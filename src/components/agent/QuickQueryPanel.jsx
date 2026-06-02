import React, { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';

export default function QuickQueryPanel({ queries }) {
  const [activeResult, setActiveResult] = useState(null);

  if (!queries || queries.length === 0) return null;

  const handleQuery = (query) => {
    setActiveResult(activeResult === query.label ? null : query.label);
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Search className="w-4 h-4 text-cyan-400" />
        <h4 className="text-sm font-medium text-slate-200">快速查詢</h4>
      </div>

      <div className="space-y-2">
        {queries.map((q, i) => (
          <div key={i}>
            <button
              onClick={() => handleQuery(q)}
              className={`w-full text-left px-3 py-2 rounded border text-xs transition-colors ${
                activeResult === q.label
                  ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                  : 'bg-slate-700/50 border-slate-600/50 text-slate-300 hover:bg-slate-700 hover:border-slate-500'
              }`}
            >
              {q.label}
            </button>
            {activeResult === q.label && (
              <div className="mt-1 px-3 py-2 bg-slate-900/50 rounded text-xs text-slate-300 border border-slate-700">
                {q.result}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
