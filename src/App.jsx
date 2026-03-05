import React, { useState } from 'react';
import DemoView from './views/DemoView';
import ConsumerView from './views/ConsumerView';
import AgentView from './views/AgentView';
import SystemView from './views/SystemView';
import HistoryView from './views/HistoryView';
import { CallProvider, useCall } from './context/CallContext';
import { ModeSwitch } from './components/ModeSwitch';
import { Presentation, Smartphone, Headphones, Settings, Phone, History } from 'lucide-react';

const viewConfig = [
  { id: 'demo', label: '展示模式', icon: Presentation, description: '商家決策者視角' },
  { id: 'consumer', label: '消費者視角', icon: Smartphone, description: '終端用戶體驗' },
  { id: 'agent', label: '客服視角', icon: Headphones, description: '值機人員介面' },
  { id: 'system', label: '系統視角', icon: Settings, description: '技術人員監控' },
  { id: 'history', label: '歷史紀錄', icon: History, description: '通話記錄總覽' },
];

/** Header 中的模式切換（需在 CallProvider 內部才能取得 context） */
function HeaderModeSwitch() {
  const { voiceMode, switchMode, callState, connectionStatus, geminiConnectionStatus } = useCall();
  return (
    <ModeSwitch
      voiceMode={voiceMode}
      onModeChange={switchMode}
      disabled={callState === 'connected' || callState === 'dialing'}
      connectionStatus={connectionStatus}
      geminiConnectionStatus={geminiConnectionStatus}
      compact={true}
    />
  );
}

export default function App() {
  const [currentView, setCurrentView] = useState('demo');

  const renderView = () => {
    switch (currentView) {
      case 'demo':
        return <DemoView />;
      case 'consumer':
        return <ConsumerView />;
      case 'agent':
        return <AgentView />;
      case 'system':
        return <SystemView />;
      case 'history':
        return <HistoryView />;
      default:
        return <DemoView />;
    }
  };

  return (
    <CallProvider>
      <div className="h-screen flex flex-col bg-slate-900">
        {/* 頂部導航列 */}
        <header className="bg-slate-800 border-b border-slate-700 px-6 py-3 flex-shrink-0 min-w-0">
          <div className="flex items-center gap-4 min-w-0">
            {/* Logo 與標題 */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Phone className="w-5 h-5 text-white" />
              </div>
              <div className="hidden lg:block">
                <h1 className="text-lg font-bold text-white">AI 語音客服助理</h1>
                <p className="text-xs text-slate-400">智能語音對話系統展示平台</p>
              </div>
            </div>

            {/* 視角切換 (flex-1 讓 nav 填充中間，兩側固定不壓縮) */}
            <nav className="flex flex-1 justify-center items-center gap-1 bg-slate-900/50 rounded-xl p-1 min-w-0 overflow-x-auto">
              {viewConfig.map((view) => {
                const Icon = view.icon;
                const isActive = currentView === view.id;
                return (
                  <button
                    key={view.id}
                    onClick={() => setCurrentView(view.id)}
                    className={`flex items-center gap-2 px-3 xl:px-4 py-2 rounded-lg transition-all cursor-pointer flex-shrink-0 ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700'
                    }`}
                    title={view.description}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium hidden xl:inline">{view.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* 右側 - 模式切換 + 狀態 */}
            <div className="flex items-center gap-4 flex-shrink-0">
              <HeaderModeSwitch />
              <div className="w-px h-8 bg-slate-700" />
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" title="系統運行中" />
            </div>
          </div>
        </header>

        {/* 主要內容區 */}
        <main className="flex-1 overflow-hidden">
          {renderView()}
        </main>
      </div>
    </CallProvider>
  );
}
