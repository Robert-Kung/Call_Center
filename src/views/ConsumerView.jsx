import React, { useRef, useEffect } from 'react';
import { Phone, PhoneOff, Mic, MicOff, ChevronLeft, Loader2, Building2, UtensilsCrossed, Hotel, Volume2, Radio, Wifi, Sparkles, AlertCircle } from 'lucide-react';
import { useCall } from '../context/CallContext';
import { ModeSwitch } from '../components/ModeSwitch';

// Icon 映射
const iconMap = {
  Building2,
  UtensilsCrossed,
  Hotel
};

export default function ConsumerView() {
  const {
    scenario,
    scenarios,
    callState,
    callDuration,
    isMuted,
    displayedConversations,
    conversationIndex,
    selectScenario,
    dial,
    hangUp,
    goBack,
    toggleMute,
    nextStep,
    formatDuration,
    // 新增的模式相關
    voiceMode,
    switchMode,
    connectionStatus,
    geminiConnectionStatus,
    isProcessing,
    error,
    clearError,
    // Gemini Live 串流
    isStreaming,
    // 錄音相關
    isRecording,
    audioLevel,
    micPermission,
    micError,
    startRecording,
    stopRecordingAndSend,
    requestMicPermission,
    // 播放相關
    isPlaying
  } = useCall();

  const chatContainerRef = useRef(null);

  // 自動滾動對話到底部
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [displayedConversations]);

  const IconComponent = scenario ? iconMap[scenario.icon] : null;

  // PTT 按鈕處理
  const handlePTTStart = async (e) => {
    e.preventDefault();
    if (voiceMode !== 'mock' && callState === 'connected' && !isProcessing) {
      await startRecording();
    }
  };

  const handlePTTEnd = async (e) => {
    e.preventDefault();
    if (isRecording) {
      await stopRecordingAndSend();
    }
  };

  // 錯誤提示元件
  const ErrorBanner = () => {
    const displayError = error || micError;
    if (!displayError) return null;

    return (
      <div className="absolute top-14 left-4 right-4 z-30 bg-red-500/90 backdrop-blur text-white text-sm px-4 py-2 rounded-xl flex items-center gap-2">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1">{displayError}</span>
        <button
          onClick={() => { clearError(); }}
          className="text-white/80 hover:text-white cursor-pointer"
        >
          ×
        </button>
      </div>
    );
  };

  return (
    <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* 模式切換 - 手機外部 */}
      <div className="absolute top-6 right-6">
        <ModeSwitch
          voiceMode={voiceMode}
          onModeChange={switchMode}
          disabled={callState === 'connected' || callState === 'dialing'}
          connectionStatus={connectionStatus}
          geminiConnectionStatus={geminiConnectionStatus}
          compact={false}
        />
      </div>

      {/* 手機框架 */}
      <div className="w-[390px] h-[844px] bg-black rounded-[55px] p-4 shadow-2xl border border-slate-700">
        <div className="w-full h-full bg-slate-950 rounded-[45px] overflow-hidden flex flex-col relative">
          {/* 動態島 */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[35px] bg-black rounded-b-3xl z-20 flex items-center justify-center">
            <div className="w-3 h-3 bg-slate-800 rounded-full" />
            {callState === 'connected' && (
              <div className="absolute -right-16 top-2 flex items-center gap-1 px-2 py-0.5 bg-emerald-500 rounded-full">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                <span className="text-[10px] text-white font-medium">{formatDuration(callDuration)}</span>
              </div>
            )}
            {/* 模式指示 */}
            {callState === 'connected' && (
              <div className={`absolute -left-14 top-2 flex items-center gap-1 px-2 py-0.5 rounded-full ${
                voiceMode === 'gemini-live' ? 'bg-purple-500' :
                voiceMode === 'rest-live' ? 'bg-green-500' : 'bg-indigo-500'
              }`}>
                {voiceMode === 'gemini-live' ? <Sparkles className="w-3 h-3 text-white" /> :
                 voiceMode === 'rest-live' ? <Wifi className="w-3 h-3 text-white" /> :
                 <Radio className="w-3 h-3 text-white" />}
                <span className="text-[10px] text-white font-medium">
                  {voiceMode === 'gemini-live' ? 'Gemini' : voiceMode === 'rest-live' ? 'REST' : 'Demo'}
                </span>
              </div>
            )}
          </div>

          {/* 錯誤提示 */}
          <ErrorBanner />

          {/* 主要內容 */}
          <div className="flex-1 min-h-0 bg-gradient-to-b from-slate-900 to-slate-950 pt-12 flex flex-col overflow-hidden">
            {!scenario ? (
              // 聯絡人選擇畫面
              <div className="flex-1 flex flex-col">
                <div className="p-6 text-center">
                  <h2 className="text-2xl font-bold text-white">客服專線</h2>
                  <p className="text-sm text-slate-400 mt-2">選擇服務類型開始通話</p>
                  {/* 模式提示 */}
                  <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${
                    voiceMode === 'gemini-live' ? 'bg-purple-500/20 text-purple-400' :
                    voiceMode === 'rest-live' ? 'bg-green-500/20 text-green-400' :
                    'bg-indigo-500/20 text-indigo-400'
                  }`}>
                    {voiceMode === 'gemini-live' ? <Sparkles className="w-3 h-3" /> :
                     voiceMode === 'rest-live' ? <Wifi className="w-3 h-3" /> :
                     <Radio className="w-3 h-3" />}
                    {voiceMode === 'gemini-live' ? 'Gemini Live 模式' :
                     voiceMode === 'rest-live' ? 'REST 即時模式' : '演示模式'}
                  </div>
                </div>
                <div className="flex-1 px-6 space-y-4">
                  {Object.entries(scenarios).map(([key, s]) => {
                    const Icon = iconMap[s.icon];
                    return (
                      <button
                        key={key}
                        onClick={() => selectScenario(key)}
                        className={`w-full p-5 rounded-3xl ${s.bgLight} hover:scale-[1.02] transition-all flex items-center gap-4 cursor-pointer border border-white/5 hover:border-white/10`}
                      >
                        <div className={`w-16 h-16 bg-gradient-to-br ${s.gradientFrom} ${s.gradientTo} rounded-2xl flex items-center justify-center shadow-lg`}>
                          <Icon className="w-8 h-8 text-white" />
                        </div>
                        <div className="text-left flex-1">
                          <div className="text-lg font-semibold text-white">{s.name}</div>
                          <div className="text-sm text-slate-400 mt-0.5">{s.companyInfo.service}</div>
                          <div className="text-xs text-slate-500 mt-1">{s.companyInfo.number}</div>
                        </div>
                        <ChevronLeft className="w-5 h-5 text-slate-500 rotate-180" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : callState === 'idle' ? (
              // 準備撥號畫面
              <div className="flex-1 flex flex-col">
                <button
                  onClick={goBack}
                  className="absolute top-14 left-6 text-slate-400 hover:text-white flex items-center gap-1 text-sm z-10 cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                  返回
                </button>

                <div className="flex-1 flex flex-col items-center justify-center p-8">
                  <div className={`w-32 h-32 bg-gradient-to-br ${scenario.gradientFrom} ${scenario.gradientTo} rounded-full flex items-center justify-center shadow-2xl`}>
                    <IconComponent className="w-16 h-16 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mt-6">{scenario.name}</h3>
                  <p className="text-slate-400 mt-2">{scenario.companyInfo.service}</p>
                  <p className="text-slate-500 text-sm mt-1">{scenario.companyInfo.number}</p>

                  {/* 模式提示 */}
                  <div className={`mt-4 flex items-center gap-2 px-4 py-2 rounded-full text-sm ${
                    voiceMode === 'gemini-live' ? 'bg-purple-500/20 text-purple-400' :
                    voiceMode === 'rest-live' ? 'bg-green-500/20 text-green-400' :
                    'bg-indigo-500/20 text-indigo-400'
                  }`}>
                    {voiceMode === 'gemini-live' ? <Sparkles className="w-4 h-4" /> :
                     voiceMode === 'rest-live' ? <Wifi className="w-4 h-4" /> :
                     <Radio className="w-4 h-4" />}
                    {voiceMode === 'gemini-live' ? 'Gemini Live 模式' :
                     voiceMode === 'rest-live' ? 'REST 即時模式' : '演示模式'}
                  </div>

                  {/* Live 模式麥克風權限提示 */}
                  {voiceMode !== 'mock' && micPermission === 'denied' && (
                    <div className="mt-3 text-red-400 text-sm text-center">
                      <p>麥克風權限被拒絕</p>
                      <button
                        onClick={requestMicPermission}
                        className="mt-1 text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                      >
                        重新申請權限
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-8">
                  <button
                    onClick={dial}
                    className="w-full py-5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full flex items-center justify-center gap-3 transition-colors shadow-lg shadow-emerald-500/30 text-lg font-semibold cursor-pointer"
                  >
                    <Phone className="w-6 h-6" />
                    撥打客服專線
                  </button>
                </div>
              </div>
            ) : callState === 'dialing' ? (
              // 撥號中畫面
              <div className="flex-1 flex flex-col items-center justify-center p-8">
                <div className={`w-32 h-32 bg-gradient-to-br ${scenario.gradientFrom} ${scenario.gradientTo} rounded-full flex items-center justify-center shadow-2xl animate-pulse`}>
                  <IconComponent className="w-16 h-16 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mt-6">{scenario.name}</h3>
                <p className="text-slate-400 mt-4 flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {voiceMode === 'gemini-live' ? '連接 Gemini Live...' :
                   voiceMode === 'rest-live' ? '連接語音服務...' : '撥號中...'}
                </p>
                <div className="mt-auto pb-8">
                  <button
                    onClick={hangUp}
                    className="w-20 h-20 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-lg shadow-red-500/30 cursor-pointer"
                  >
                    <PhoneOff className="w-8 h-8" />
                  </button>
                </div>
              </div>
            ) : callState === 'connected' ? (
              // 通話中畫面
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* 頂部資訊 */}
                <div className="flex-shrink-0 p-4 text-center">
                  <div className={`w-16 h-16 bg-gradient-to-br ${scenario.gradientFrom} ${scenario.gradientTo} rounded-full flex items-center justify-center mx-auto shadow-lg`}>
                    <IconComponent className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white mt-2">{scenario.name}</h3>
                  <p className="text-emerald-400 text-sm flex items-center justify-center gap-1">
                    {isPlaying && <Volume2 className="w-3 h-3 animate-pulse" />}
                    {isProcessing ? '處理中...' : isRecording ? '錄音中...' : isPlaying ? '播放中' : isStreaming ? '即時串流中' : '通話中'}
                  </p>
                </div>

                {/* 對話區域 */}
                <div
                  ref={chatContainerRef}
                  className="flex-1 min-h-0 overflow-y-auto px-4 space-y-3"
                >
                  {displayedConversations.length === 0 && voiceMode !== 'mock' && (
                    <div className="text-center text-slate-500 text-sm py-8">
                      {voiceMode === 'gemini-live' ? (
                        <>
                          <p>🎙️ 即時串流已啟動</p>
                          <p className="mt-1">直接說話即可，AI 會自動回應</p>
                        </>
                      ) : (
                        <>
                          <p>按住下方麥克風按鈕說話</p>
                          <p className="mt-1">放開後自動送出</p>
                        </>
                      )}
                    </div>
                  )}
                  {displayedConversations.map((conv, idx) => (
                    <div
                      key={conv.id || idx}
                      className={`flex ${conv.speaker === 'customer' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                          conv.speaker === 'customer'
                            ? 'bg-indigo-500 text-white rounded-br-md'
                            : 'bg-slate-700 text-slate-100 rounded-bl-md'
                        }`}
                      >
                        <p className="text-sm leading-relaxed">{conv.text}</p>
                      </div>
                    </div>
                  ))}
                  {/* 處理中指示 */}
                  {isProcessing && (
                    <div className="flex justify-start">
                      <div className="bg-slate-700 text-slate-100 px-4 py-3 rounded-2xl rounded-bl-md">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">AI 思考中...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 控制區域 */}
                <div className="flex-shrink-0 p-4 space-y-3">
                  {voiceMode === 'mock' ? (
                    // Mock 模式 - 下一步按鈕
                    <button
                      onClick={nextStep}
                      className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Volume2 className="w-4 h-4" />
                      {conversationIndex < (scenario?.conversations.length || 0) - 1
                        ? `下一步 (${conversationIndex + 2}/${scenario?.conversations.length})`
                        : '結束通話'}
                    </button>
                  ) : voiceMode === 'gemini-live' ? (
                    // Gemini Live 模式 - 串流狀態指示器 (不需要 PTT)
                    <div className="flex items-center justify-center gap-3 py-3 px-4 bg-slate-800/50 rounded-xl border border-purple-500/20">
                      <div className="relative flex items-center justify-center">
                        <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse" />
                        <div className="absolute w-6 h-6 bg-purple-500/20 rounded-full animate-ping" />
                      </div>
                      <span className="text-sm text-purple-300 font-medium">
                        {isPlaying ? '🔊 AI 回應中...' : '🎤 聆聽中 — 直接說話'}
                      </span>
                    </div>
                  ) : (
                    // REST Live 模式 - PTT 按鈕
                    <div className="relative">
                      {/* 音量指示器 */}
                      {isRecording && (
                        <div className="absolute -top-2 left-0 right-0 h-1 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 transition-all duration-75"
                            style={{ width: `${audioLevel * 100}%` }}
                          />
                        </div>
                      )}
                      <button
                        onMouseDown={handlePTTStart}
                        onMouseUp={handlePTTEnd}
                        onMouseLeave={handlePTTEnd}
                        onTouchStart={handlePTTStart}
                        onTouchEnd={handlePTTEnd}
                        disabled={isProcessing}
                        className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer select-none ${
                          isRecording
                            ? 'bg-green-500 text-white scale-[1.02]'
                            : isProcessing
                            ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                            : 'bg-slate-700 hover:bg-slate-600 text-white active:bg-green-500 active:scale-[1.02]'
                        }`}
                      >
                        <Mic className={`w-5 h-5 ${isRecording ? 'animate-pulse' : ''}`} />
                        <span className="font-medium">
                          {isRecording ? '放開送出' : isProcessing ? '處理中...' : '按住說話'}
                        </span>
                      </button>
                    </div>
                  )}

                  {/* 通話控制 */}
                  <div className="flex justify-center gap-4">
                    <button
                      onClick={toggleMute}
                      className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                        isMuted
                          ? 'bg-slate-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={hangUp}
                      className="w-14 h-14 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-lg shadow-red-500/30 cursor-pointer"
                    >
                      <PhoneOff className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              // 通話結束畫面
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* 頂部資訊 */}
                <div className="flex-shrink-0 p-4 text-center border-b border-slate-800">
                  <div className="flex items-center justify-center gap-3">
                    <div className={`w-12 h-12 bg-gradient-to-br ${scenario.gradientFrom} ${scenario.gradientTo} rounded-full flex items-center justify-center opacity-60`}>
                      <IconComponent className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-lg font-bold text-white">{scenario.name}</h3>
                      <p className="text-slate-400 text-sm">通話結束 - {formatDuration(callDuration)}</p>
                    </div>
                  </div>
                </div>

                {/* 對話記錄 */}
                <div
                  ref={chatContainerRef}
                  className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3"
                >
                  {displayedConversations.map((conv, idx) => (
                    <div
                      key={conv.id || idx}
                      className={`flex ${conv.speaker === 'customer' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                          conv.speaker === 'customer'
                            ? 'bg-indigo-500 text-white rounded-br-md'
                            : 'bg-slate-700 text-slate-100 rounded-bl-md'
                        }`}
                      >
                        <p className="text-sm leading-relaxed">{conv.text}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 返回按鈕 */}
                <div className="flex-shrink-0 p-4">
                  <button
                    onClick={goBack}
                    className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-full flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    返回選單
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 底部指示條 */}
          <div className="h-8 bg-black flex items-center justify-center">
            <div className="w-36 h-1 bg-slate-600 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
