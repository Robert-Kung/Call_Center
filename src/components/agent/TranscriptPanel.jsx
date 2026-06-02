import React, { useRef, useEffect } from 'react';
import { User, Bot, Loader2 } from 'lucide-react';

export default function TranscriptPanel({ conversations, streamingAiText, isStreaming }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [conversations, streamingAiText]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-700">
        <h3 className="text-sm font-medium text-slate-300">即時對話</h3>
      </div>
      <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {conversations.map((conv, i) => (
          <div key={i} className={`flex gap-2 ${conv.speaker === 'ai' ? '' : 'flex-row-reverse'}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
              conv.speaker === 'ai' ? 'bg-indigo-500/20' : 'bg-emerald-500/20'
            }`}>
              {conv.speaker === 'ai'
                ? <Bot className="w-3.5 h-3.5 text-indigo-400" />
                : <User className="w-3.5 h-3.5 text-emerald-400" />
              }
            </div>
            <div className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
              conv.speaker === 'ai'
                ? 'bg-slate-700 text-slate-200'
                : 'bg-emerald-900/30 text-emerald-100'
            }`}>
              {conv.text}
            </div>
          </div>
        ))}

        {streamingAiText && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-indigo-500/20">
              <Bot className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="max-w-[80%] px-3 py-2 rounded-lg text-sm bg-slate-700 text-slate-200">
              {streamingAiText}
              <span className="inline-block w-1.5 h-4 bg-indigo-400 ml-1 animate-pulse" />
            </div>
          </div>
        )}

        {isStreaming && !streamingAiText && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-indigo-500/20">
              <Bot className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="px-3 py-2 rounded-lg bg-slate-700">
              <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
            </div>
          </div>
        )}

        {conversations.length === 0 && !isStreaming && (
          <div className="text-center text-slate-500 text-sm py-8">等待通話開始...</div>
        )}
      </div>
    </div>
  );
}
