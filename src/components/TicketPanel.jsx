import React, { useState } from 'react';
import { FileText, CheckCircle2, Clock, MapPin, User, Phone, Calendar, CreditCard, AlertCircle, Building2, UtensilsCrossed, Stethoscope, Truck, ChevronDown, ChevronUp } from 'lucide-react';
import { useCall } from '../context/CallContext';

// 欄位標籤映射
const fieldLabels = {
  // 頂層共用欄位
  summary: { label: '摘要', icon: null },
  customerName: { label: '客戶姓名', icon: User },
  contactPhone: { label: '聯絡電話', icon: Phone },
  priority: { label: '優先序', icon: null },
  status: { label: '狀態', icon: CheckCircle2 },
  // 聯絡資訊
  name: { label: '姓名', icon: User },
  phone: { label: '電話', icon: Phone },
  contact: { label: '聯絡人', icon: User },
  // 地址類
  address: { label: '地址', icon: MapPin },
  newAddress: { label: '新地址', icon: MapPin },
  // 時間類
  date: { label: '日期', icon: Calendar },
  time: { label: '時間', icon: Clock },
  scheduledTime: { label: '預約時間', icon: Calendar },
  requestDate: { label: '指定日期', icon: Calendar },
  dueDate: { label: '繳費截止日', icon: Calendar },
  effectiveDate: { label: '生效日期', icon: Calendar },
  checkIn: { label: '入住', icon: Calendar },
  checkOut: { label: '退房', icon: Calendar },
  holdUntil: { label: '保留至', icon: Clock },
  // 費用類
  fee: { label: '費用說明', icon: CreditCard },
  billAmount: { label: '帳單金額', icon: CreditCard },
  price: { label: '房價', icon: CreditCard },
  total: { label: '總額', icon: CreditCard },
  deposit: { label: '訂金', icon: CreditCard },
  // 電信報修
  account: { label: '帳號', icon: null },
  accountHolder: { label: '戶名', icon: User },
  issue: { label: '問題', icon: AlertCircle },
  diagnosis: { label: '初步診斷', icon: null },
  // 電信費用/方案
  queryPeriod: { label: '查詢期間', icon: null },
  phoneNumber: { label: '門號', icon: Phone },
  currentPlan: { label: '目前方案', icon: null },
  targetPlan: { label: '變更方案', icon: null },
  // 訂位
  guests: { label: '人數', icon: User },
  table: { label: '座位', icon: null },
  specialNeeds: { label: '特殊需求', icon: null },
  notes: { label: '備註', icon: null },
  // 住宿
  nights: { label: '晚數', icon: null },
  rooms: { label: '房間', icon: null },
  includes: { label: '包含', icon: null },
  cancelPolicy: { label: '取消政策', icon: null },
  petNote: { label: '寵物備註', icon: null },
  // 醫療掛號
  department: { label: '科別', icon: null },
  patientId: { label: '身分證字號', icon: User },
  dob: { label: '生日', icon: Calendar },
  symptoms: { label: '症狀備註', icon: AlertCircle },
  // 物流
  trackingNumber: { label: '托運單號', icon: null }
};

// 根據單據類型取得圖示
const getTicketIcon = (type) => {
  if (type.includes('報修') || type.includes('電信') || type.includes('費用') || type.includes('方案')) return Building2;
  if (type.includes('訂位') || type.includes('餐')) return UtensilsCrossed;
  if (type.includes('醫療') || type.includes('掛號')) return Stethoscope;
  if (type.includes('物流') || type.includes('配送') || type.includes('貨件')) return Truck;
  return FileText;
};

// 根據狀態取得樣式
const getStatusStyle = (status) => {
  if (status.includes('已確認') || status.includes('處理中')) {
    return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  }
  if (status.includes('保留') || status.includes('待確認')) {
    return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  }
  return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
};

export default function TicketPanel() {
  const { tickets } = useCall();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex flex-col bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden">
      {/* 標題列 */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="px-4 py-3 border-b border-slate-700/50 flex items-center gap-2 bg-slate-800/80 w-full text-left hover:bg-slate-700/40 transition-colors"
      >
        <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <FileText className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="flex-1">
          <h2 className="font-semibold text-white text-sm">產生單據</h2>
          <p className="text-xs text-slate-400">Generated Tickets</p>
        </div>
        {tickets.length > 0 && (
          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full text-xs mr-1">
            {tickets.length}
          </span>
        )}
        {collapsed
          ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
          : <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />}
      </button>

      {/* 內容區 */}
      {!collapsed && (
      <div className="p-4 max-h-[400px] overflow-y-auto">
        {tickets.length === 0 ? (
          <div className="py-6 flex flex-col items-center justify-center text-slate-500">
            <FileText className="w-10 h-10 mb-2 opacity-30" />
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
                      if (value === '' || value === null || value === undefined) return null;
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
      )}
    </div>
  );
}
