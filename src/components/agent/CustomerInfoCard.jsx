import React from 'react';
import { User, Phone, MapPin } from 'lucide-react';

export default function CustomerInfoCard({ analysis, scenario }) {
  if (!analysis && !scenario) return null;

  const entities = analysis?.entities || [];
  const companyInfo = scenario?.companyInfo;

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="flex items-center gap-2 mb-3">
        <User className="w-4 h-4 text-cyan-400" />
        <h4 className="text-sm font-medium text-slate-200">客戶資訊</h4>
      </div>

      {companyInfo && (
        <div className="mb-3 pb-3 border-b border-slate-700">
          <div className="text-xs text-slate-400 mb-1">來電線路</div>
          <div className="flex items-center gap-2">
            <Phone className="w-3 h-3 text-slate-500" />
            <span className="text-sm text-slate-300">{companyInfo.number}</span>
          </div>
        </div>
      )}

      {entities.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs text-slate-400">識別資訊</div>
          <div className="flex flex-wrap gap-1.5">
            {entities.map((entity, i) => (
              <span key={i} className="px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/20 rounded text-xs text-cyan-300">
                {entity}
              </span>
            ))}
          </div>
        </div>
      )}

      {!entities.length && !companyInfo && (
        <div className="text-xs text-slate-500">尚無客戶資訊</div>
      )}
    </div>
  );
}
