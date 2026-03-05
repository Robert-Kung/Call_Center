import React, { useRef, useEffect } from 'react';
import { MessageSquare, User, Bot, ArrowRight } from 'lucide-react';
import { useCall } from '../context/CallContext';

export default function ConversationPanel({ showNextButton = true }) {
  const {
    scenario,
    callState,
    displayedConversations,
    conversationIndex,
    nextStep,
    voiceMode
  } = useCall();

  const chatContainerRef = useRef(null);

  // 自動滾動到底部
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [displayedConversations]);

  return (
    <div className="h-full flex flex-col bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden">
      {/* 標題列 */}
      <div className="px-4 py-3 border-b border-slate-700/50 flex items-center gap-2 bg-slate-800/80">
        <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center">
          <MessageSquare className="w-4 h-4 text-indigo-400" />
        </div>
        <div>
          <h2 className="font-semibold text-white text-sm">即時對話逐字稿</h2>
          <p className="text-xs text-slate-400">Real-time Transcription</p>
        </div>
        {displayedConversations.length > 0 && (
          <span className="ml-auto px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full text-xs">
            {displayedConversations.length} 則對話
          </span>
        )}
      </div>

      {/* 對話內容區 */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {displayedConversations.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">
              {callState === 'connected' ? '點擊「下一步」開始對話模擬' : '等待通話接通...'}
            </p>
          </div>
        ) : (
          displayedConversations.map((conv, idx) => (
            <div
              key={conv.id || idx}
              className={`flex ${conv.speaker === 'customer' ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-[85%] flex gap-2 ${
                  conv.speaker === 'customer' ? 'flex-row' : 'flex-row-reverse'
                }`}
              >
                {/* 頭像 */}
                <div
                  className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                    conv.speaker === 'customer'
                      ? 'bg-slate-600'
                      : 'bg-gradient-to-br from-indigo-500 to-purple-500'
                  }`}
                >
                  {conv.speaker === 'customer' ? (
                    <User className="w-4 h-4 text-slate-300" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </div>

                {/* 訊息氣泡 */}
                <div
                  className={`px-4 py-3 rounded-2xl ${
                    conv.speaker === 'customer'
                      ? 'bg-slate-700 text-slate-100 rounded-bl-md'
                      : 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-br-md'
                  }`}
                >
                  <div className="text-xs opacity-70 mb-1 font-medium">
                    {conv.speaker === 'customer' ? '客戶' : 'AI 助理'}
                  </div>
                  <p className="text-sm leading-relaxed">{conv.text}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 下一步按鈕 — Mock 模式才顯示 */}
      {showNextButton && callState === 'connected' && voiceMode === 'mock' && (
        <div className="p-4 border-t border-slate-700/50">
          <button
            onClick={nextStep}
            className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20 cursor-pointer"
          >
            {conversationIndex < (scenario?.conversations.length || 0) - 1 ? (
              <>
                <span>下一步對話</span>
                <span className="text-indigo-200 text-sm">
                  ({conversationIndex + 2}/{scenario?.conversations.length})
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              '結束通話'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
