import React from 'react';
import { Phone, PhoneOff, Mic, MicOff, ChevronLeft, Loader2, Building2, UtensilsCrossed, Stethoscope, Truck, Sparkles, Radio, Wifi } from 'lucide-react';
import { useCall } from '../context/CallContext';

// Icon 映射
const iconMap = {
  Building2,
  UtensilsCrossed,
  Stethoscope,
  Truck
};

export default function PhoneSimulator({ compact = false }) {
  const {
    scenario,
    scenarios,
    callState,
    callDuration,
    isMuted,
    selectScenario,
    dial,
    hangUp,
    goBack,
    toggleMute,
    formatDuration,
    voiceMode,
    isStreaming
  } = useCall();

  const IconComponent = scenario ? iconMap[scenario.icon] : null;

  const containerClass = compact
    ? 'w-64 h-[520px]'
    : 'w-80 h-[640px]';

  return (
    <div className={`${containerClass} bg-slate-900 rounded-[3rem] p-3 shadow-2xl border border-slate-700`}>
      <div className="w-full h-full bg-slate-950 rounded-[2.5rem] overflow-hidden flex flex-col">
        {/* 手機頂部 - 動態島 */}
        <div className="h-8 bg-black flex items-center justify-center relative">
          <div className="w-24 h-6 bg-black rounded-full absolute top-0" />
          <div className="w-3 h-3 bg-slate-800 rounded-full absolute left-1/2 -translate-x-1/2 top-1" />
        </div>

        {/* 手機內容 */}
        <div className="flex-1 bg-gradient-to-b from-slate-900 to-slate-950 relative overflow-hidden">
          {!scenario ? (
            // 聯絡人選擇畫面
            <div className="h-full flex flex-col">
              <div className="p-4 text-center border-b border-slate-800">
                <h2 className="text-lg font-semibold text-white">選擇撥打對象</h2>
                <p className="text-xs text-slate-400 mt-1">點擊開始模擬通話</p>
              </div>
              <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                {Object.entries(scenarios).map(([key, s]) => {
                  const Icon = iconMap[s.icon];
                  return (
                    <button
                      key={key}
                      onClick={() => selectScenario(key)}
                      className={`w-full p-4 rounded-2xl ${s.bgLight} hover:scale-[1.02] transition-all flex items-center gap-4 cursor-pointer border border-transparent hover:border-white/10`}
                    >
                      <div className={`w-14 h-14 bg-gradient-to-br ${s.gradientFrom} ${s.gradientTo} rounded-full flex items-center justify-center shadow-lg`}>
                        <Icon className="w-7 h-7 text-white" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-white">{s.name}</div>
                        <div className="text-xs text-slate-400">{s.companyInfo.number}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            // 通話畫面
            <div className="h-full flex flex-col">
              {/* 返回按鈕 */}
              {callState === 'idle' && (
                <button
                  onClick={goBack}
                  className="absolute top-4 left-4 text-slate-400 hover:text-white flex items-center gap-1 text-sm z-10 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  返回
                </button>
              )}

              {/* 通話資訊 */}
              <div className="flex-1 flex flex-col items-center justify-center p-6">
                {/* 頭像 */}
                <div className={`relative ${callState === 'dialing' ? 'animate-pulse' : ''}`}>
                  <div className={`w-28 h-28 bg-gradient-to-br ${scenario.gradientFrom} ${scenario.gradientTo} rounded-full flex items-center justify-center shadow-xl`}>
                    <IconComponent className="w-14 h-14 text-white" />
                  </div>
                  {callState === 'connected' && (
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-4 border-slate-950 flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    </div>
                  )}
                </div>

                {/* 名稱與號碼 */}
                <h3 className="text-xl font-semibold text-white mt-4">{scenario.name}</h3>
                <p className="text-sm text-slate-400 mt-1">{scenario.companyInfo.number}</p>

                {/* 狀態文字 */}
                <div className="mt-6 h-8 flex items-center">
                  {callState === 'idle' && (
                    <p className="text-sm text-slate-500">點擊撥打開始通話</p>
                  )}
                  {callState === 'dialing' && (
                    <p className="text-sm text-slate-400 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      撥號中...
                    </p>
                  )}
                  {callState === 'connected' && (
                    <div className="text-center">
                      <p className="text-sm text-emerald-400 font-medium">
                        通話中
                      </p>
                      <p className="text-2xl font-mono text-white mt-1">
                        {formatDuration(callDuration)}
                      </p>
                      {/* 模式標籤 */}
                      <span className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        voiceMode === 'mock' ? 'bg-slate-700 text-slate-400' :
                        voiceMode === 'rest-live' ? 'bg-cyan-500/20 text-cyan-300' :
                        'bg-purple-500/20 text-purple-300'
                      }`}>
                        {voiceMode === 'gemini-live' && <Sparkles className="w-2.5 h-2.5" />}
                        {voiceMode === 'mock' ? 'Mock' : voiceMode === 'rest-live' ? 'WS Live' : 'Gemini'}
                        {(voiceMode === 'gemini-live' || voiceMode === 'rest-live') && isStreaming && (
                          <Radio className="w-2.5 h-2.5 animate-pulse" />
                        )}
                      </span>
                    </div>
                  )}
                  {callState === 'ended' && (
                    <div className="text-center">
                      <p className="text-sm text-slate-400">通話結束</p>
                      <p className="text-lg font-mono text-slate-300 mt-1">
                        {formatDuration(callDuration)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 通話控制按鈕 */}
              <div className="p-6 pb-8">
                {callState === 'idle' && (
                  <button
                    onClick={dial}
                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-500/30 cursor-pointer"
                  >
                    <Phone className="w-5 h-5" />
                    撥打
                  </button>
                )}
                {callState === 'dialing' && (
                  <button
                    onClick={hangUp}
                    className="w-full py-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center gap-2 transition-colors shadow-lg shadow-red-500/30 cursor-pointer"
                  >
                    <PhoneOff className="w-5 h-5" />
                    取消
                  </button>
                )}
                {callState === 'connected' && (
                  <div className="flex gap-3">
                    <button
                      onClick={toggleMute}
                      className={`flex-1 py-4 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                        isMuted
                          ? 'bg-slate-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={hangUp}
                      className="flex-1 py-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-lg shadow-red-500/30 cursor-pointer"
                    >
                      <PhoneOff className="w-5 h-5" />
                    </button>
                  </div>
                )}
                {callState === 'ended' && (
                  <button
                    onClick={goBack}
                    className="w-full py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-full flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    返回選單
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 手機底部指示條 */}
        <div className="h-6 bg-black flex items-center justify-center">
          <div className="w-32 h-1 bg-slate-600 rounded-full" />
        </div>
      </div>
    </div>
  );
}
