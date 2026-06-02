import React from 'react';
import { PhoneForwarded, X, CheckCircle, User, FileText } from 'lucide-react';

export default function HandoffOverlay({ handoffPackage, onConfirm, onCancel }) {
  if (!handoffPackage) return null;

  return (
    <div className="absolute inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-8">
      <div className="bg-slate-800 rounded-xl border border-slate-600 w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
            <PhoneForwarded className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-white">轉接真人客服</h3>
            <p className="text-xs text-slate-400">以下資訊將傳送給接手的客服人員</p>
          </div>
        </div>

        <div className="space-y-3 max-h-64 overflow-y-auto">
          <div className="p-3 bg-slate-700/50 rounded-lg">
            <div className="text-xs text-slate-400 mb-1">摘要</div>
            <p className="text-sm text-slate-200">{handoffPackage.summary}</p>
          </div>

          <div className="p-3 bg-slate-700/50 rounded-lg">
            <div className="text-xs text-slate-400 mb-1">客戶情緒</div>
            <p className="text-sm text-slate-200">{handoffPackage.emotionState}</p>
          </div>

          {handoffPackage.tickets && handoffPackage.tickets.length > 0 && (
            <div className="p-3 bg-slate-700/50 rounded-lg">
              <div className="text-xs text-slate-400 mb-1">工單 ({handoffPackage.tickets.length})</div>
              {handoffPackage.tickets.map((t, i) => (
                <div key={i} className="text-sm text-slate-200">{t.title || t.type}</div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg text-sm transition-colors"
          >
            確認轉接
          </button>
        </div>
      </div>
    </div>
  );
}
