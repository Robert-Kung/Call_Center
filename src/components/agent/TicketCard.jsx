import React from 'react';
import { FileText, CheckCircle, Clock } from 'lucide-react';

export default function TicketCard({ tickets }) {
  if (!tickets || tickets.length === 0) return null;

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-amber-400" />
        <h4 className="text-sm font-medium text-slate-200">工單</h4>
        <span className="ml-auto text-xs text-slate-400">{tickets.length} 筆</span>
      </div>

      <div className="space-y-2">
        {tickets.map((ticket, i) => (
          <div key={i} className="p-2 bg-slate-700/50 rounded border border-slate-600/50">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white font-medium">{ticket.title || ticket.type}</span>
              <span className={`flex items-center gap-1 text-xs ${
                ticket.status === 'completed' ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                {ticket.status === 'completed'
                  ? <CheckCircle className="w-3 h-3" />
                  : <Clock className="w-3 h-3" />
                }
                {ticket.status === 'completed' ? '完成' : '處理中'}
              </span>
            </div>
            {ticket.description && (
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">{ticket.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
