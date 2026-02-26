import React from 'react';
import { FileText, CheckCircle2, Clock, MapPin, User, Phone, Calendar, CreditCard, AlertCircle, Building2, UtensilsCrossed, Hotel } from 'lucide-react';
import { useCall } from '../context/CallContext';

// 欄位標籤映射
const fieldLabels = {
  name: { label: '姓名', icon: User },
  phone: { label: '電話', icon: Phone },
  address: { label: '地址', icon: MapPin },
  issue: { label: '問題', icon: AlertCircle },
  scheduledTime: { label: '預約時間', icon: Calendar },
  status: { label: '狀態', icon: CheckCircle2 },
  date: { label: '日期', icon: Calendar },
  time: { label: '時間', icon: Clock },
  guests: { label: '人數', icon: User },
  table: { label: '座位', icon: null },
  notes: { label: '備註', icon: null },
  checkIn: { label: '入住', icon: Calendar },
  checkOut: { label: '退房', icon: Calendar },
  nights: { label: '晚數', icon: null },
  rooms: { label: '房間', icon: null },
  price: { label: '房價', icon: CreditCard },
  total: { label: '總額', icon: CreditCard },
  deposit: { label: '訂金', icon: CreditCard },
  includes: { label: '包含', icon: null },
  specialNeeds: { label: '特殊需求', icon: null },
  account: { label: '帳號', icon: null },
  accountHolder: { label: '戶名', icon: User },
  contact: { label: '聯絡人', icon: User },
  diagnosis: { label: '初步診斷', icon: null },
  priority: { label: '優先序', icon: null },
  fee: { label: '費用說明', icon: CreditCard },
  holdUntil: { label: '保留至', icon: Clock },
  petNote: { label: '寵物備註', icon: null },
  cancelPolicy: { label: '取消政策', icon: null }
};

// 根據單據類型取得圖示
const getTicketIcon = (type) => {
  if (type.includes('報修') || type.includes('電信')) return Building2;
  if (type.includes('訂位') || type.includes('餐')) return UtensilsCrossed;
  if (type.includes('訂房') || type.includes('飯店') || type.includes('酒店')) return Hotel;
  return FileText;
};

// 根據狀態取得樣式
const getStatusStyle = (status) => {
  if (status.includes('已確認') || status.includes('已派工')) {
    return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  }
  if (status.includes('保留') || status.includes('待確認')) {
    return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  }
  return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
};

export default function TicketPanel() {
  const { tickets } = useCall();

  return (
    <div className="h-full flex flex-col bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden">
      {/* 標題列 */}
      <div className="px-4 py-3 border-b border-slate-700/50 flex items-center gap-2 bg-slate-800/80">
        <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
          <FileText className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <h2 className="font-semibold text-white text-sm">產生單據</h2>
          <p className="text-xs text-slate-400">Generated Tickets</p>
        </div>
        {tickets.length > 0 && (
          <span className="ml-auto px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full text-xs">
            {tickets.length}
          </span>
        )}
      </div>

      {/* 內容區 */}
      <div className="flex-1 overflow-y-auto p-4">
        {tickets.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <FileText className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">尚無單據產生</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tickets.map((ticket, idx) => {
              const TicketIcon = getTicketIcon(ticket.type);
              return (
                <div
                  key={ticket.id || idx}
                  className="p-4 bg-slate-700/30 rounded-xl border border-slate-600/30"
                >
                  {/* 單據標題 */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                        <TicketIcon className="w-4 h-4 text-emerald-400" />
                      </div>
                      <span className="font-semibold text-emerald-300 text-sm">
                        {ticket.type}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                      {ticket.ticketId}
                    </span>
                  </div>

                  {/* 單據內容 */}
                  <div className="space-y-2">
                    {Object.entries(ticket).map(([key, value]) => {
                      if (key === 'type' || key === 'ticketId' || key === 'id') return null;
                      const fieldInfo = fieldLabels[key] || { label: key, icon: null };

                      // 狀態欄位特殊處理
                      if (key === 'status') {
                        return (
                          <div key={key} className="flex items-start gap-2">
                            <span className="text-xs text-slate-500 w-20 flex-shrink-0 pt-0.5">
                              {fieldInfo.label}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded border ${getStatusStyle(value)}`}>
                              {value}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div key={key} className="flex items-start gap-2">
                          <span className="text-xs text-slate-500 w-20 flex-shrink-0">
                            {fieldInfo.label}
                          </span>
                          <span className="text-xs text-slate-300 flex-1">
                            {typeof value === 'number' ? value : value}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
