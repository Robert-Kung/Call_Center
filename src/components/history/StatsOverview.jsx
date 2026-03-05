/**
 * StatsOverview.jsx
 * 歷史紀錄統計摘要區塊 — KPI 卡片 + 圖表
 */
import React, { useMemo } from 'react';
import { Activity, Clock, MessageSquare, Target, Zap, Award, BarChart2, TrendingUp } from 'lucide-react';
import { MODE_CONFIG, formatLatency } from '../../services/SessionHistoryService';

// ── 輔助：SVG Donut Chart ────────────────────────────────────────────────────
function DonutChart({ data, size = 120 }) {
  const COLORS = {
    gemini: '#a78bfa',   // purple-400
    'rest-ws': '#22d3ee', // cyan-400
    legacy: '#94a3b8',   // slate-400
  };
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div className="w-28 h-28 rounded-full bg-slate-700/50 flex items-center justify-center text-slate-500 text-xs">無資料</div>;

  const r = 44;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  const segments = data.map((d, i) => {
    const ratio = d.value / total;
    const dash = ratio * circumference;
    const gap = circumference - dash;
    const seg = {
      key: d.name,
      color: COLORS[d.name] || '#6366f1',
      strokeDasharray: `${dash} ${gap}`,
      strokeDashoffset: -offset,
      ratio,
    };
    offset += dash;
    return seg;
  });

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="12" stroke="#1e293b" />
        {segments.map(seg => (
          <circle
            key={seg.key}
            cx="50" cy="50" r={r}
            fill="none"
            strokeWidth="12"
            stroke={seg.color}
            strokeDasharray={seg.strokeDasharray}
            strokeDashoffset={seg.strokeDashoffset}
            strokeLinecap="round"
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-white">{total}</span>
        <span className="text-xs text-slate-400">sessions</span>
      </div>
    </div>
  );
}

// ── 輔助：水平 Bar Chart ────────────────────────────────────────────────────
function HBarChart({ data, colorClass = 'bg-indigo-500', maxItems = 6 }) {
  const items = data.slice(0, maxItems);
  if (items.length === 0) return <p className="text-slate-500 text-xs text-center py-4">無資料</p>;
  const maxVal = Math.max(...items.map(d => d.value), 1);
  return (
    <div className="space-y-2">
      {items.map(d => (
        <div key={d.name} className="flex items-center gap-2">
          <span className="text-xs text-slate-400 w-20 truncate flex-shrink-0 text-right" title={d.name}>{d.name}</span>
          <div className="flex-1 h-4 bg-slate-700/60 rounded-full overflow-hidden">
            <div
              className={`h-full ${colorClass} rounded-full transition-all duration-500`}
              style={{ width: `${(d.value / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-xs text-slate-300 w-6 text-right flex-shrink-0">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── 輔助：SVG 折線圖 ────────────────────────────────────────────────────────
function SparkLineChart({ data }) {
  if (!data || data.length < 2) return <p className="text-slate-500 text-xs text-center py-4">資料不足</p>;
  const W = 260, H = 80;
  const vals = data.map(d => d.latency);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals, minV + 1);
  const xStep = W / (data.length - 1);
  const toY = v => H - ((v - minV) / (maxV - minV)) * (H - 10) - 5;

  const points = data.map((d, i) => `${i * xStep},${toY(d.latency)}`).join(' ');
  const area = `0,${H} ${points} ${(data.length - 1) * xStep},${H}`;
  const avgV = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  const avgY = toY(avgV);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {/* Grid */}
      {[0.25, 0.5, 0.75].map(f => (
        <line key={f} x1="0" y1={H * (1 - f)} x2={W} y2={H * (1 - f)} stroke="#334155" strokeWidth="0.5" strokeDasharray="4 4" />
      ))}
      {/* Area */}
      <polygon points={area} fill="url(#sparkGrad)" opacity="0.3" />
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Line */}
      <polyline points={points} fill="none" stroke="#818cf8" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Avg line */}
      <line x1="0" y1={avgY} x2={W} y2={avgY} stroke="#f59e0b" strokeWidth="1" strokeDasharray="6 3" opacity="0.7" />
      {/* Dots — only at endpoints */}
      <circle cx="0" cy={toY(vals[0])} r="3" fill="#818cf8" />
      <circle cx={(data.length - 1) * xStep} cy={toY(vals[vals.length - 1])} r="3" fill="#818cf8" />
    </svg>
  );
}

// ── KPI 卡片 ─────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, colorClass }) {
  return (
    <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400 truncate">{label}</p>
        <p className="text-xl font-bold text-white leading-tight">{value}</p>
        {sub && <p className="text-xs text-slate-500 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ── 主元件 ───────────────────────────────────────────────────────────────────
export default function StatsOverview({ stats }) {
  if (!stats) return null;

  const modeLegend = stats.modeDistribution.map(d => ({
    ...d,
    cfg: MODE_CONFIG[d.name] || MODE_CONFIG.legacy,
  }));

  return (
    <div className="space-y-4">
      {/* KPI 卡片列 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={Activity}
          label="總 Session 數"
          value={stats.total.toLocaleString()}
          sub="所有歷史通話"
          colorClass="bg-indigo-500/20 text-indigo-400"
        />
        <KpiCard
          icon={Clock}
          label="平均延遲"
          value={stats.avgLatency > 0 ? `${stats.avgLatency.toLocaleString()}ms` : '—'}
          sub="端到端回應時間"
          colorClass="bg-amber-500/20 text-amber-400"
        />
        <KpiCard
          icon={MessageSquare}
          label="平均對話輪數"
          value={stats.avgTurns}
          sub="每通電話平均"
          colorClass="bg-emerald-500/20 text-emerald-400"
        />
        <KpiCard
          icon={Target}
          label="意圖辨識率"
          value={`${stats.intentRate}%`}
          sub={`共 ${stats.totalTickets} 張工單`}
          colorClass="bg-rose-500/20 text-rose-400"
        />
      </div>

      {/* 圖表列 */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">

        {/* 模式分佈 */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-indigo-500/20 rounded-lg flex items-center justify-center">
              <BarChart2 className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white">模式分佈</h3>
              <p className="text-xs text-slate-500">Voice Mode</p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-3">
            <DonutChart data={stats.modeDistribution} size={110} />
            <div className="space-y-1 w-full">
              {modeLegend.map(d => (
                <div key={d.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${d.cfg.dot}`} />
                    <span className="text-xs text-slate-400">{d.cfg.label}</span>
                  </div>
                  <span className="text-xs font-medium text-slate-300">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 情境分佈 */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <Award className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white">情境分佈</h3>
              <p className="text-xs text-slate-500">Scenario</p>
            </div>
          </div>
          <HBarChart data={stats.scenarioDistribution} colorClass="bg-emerald-500" maxItems={6} />
        </div>

        {/* 延遲趨勢 */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-amber-500/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white">延遲趨勢</h3>
              <p className="text-xs text-slate-500">Latency Trend</p>
            </div>
          </div>
          <SparkLineChart data={stats.latencyTrend} />
          {stats.latencyTrend.length >= 2 && (
            <div className="flex items-center gap-3 mt-2 justify-end">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-indigo-400 rounded" />
                <span className="text-xs text-slate-500">延遲</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 border-t border-dashed border-amber-400" />
                <span className="text-xs text-slate-500">平均</span>
              </div>
            </div>
          )}
        </div>

        {/* 意圖分佈 */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white">意圖分佈</h3>
              <p className="text-xs text-slate-500">Intent Distribution</p>
            </div>
          </div>
          {stats.intentDistribution.length > 0
            ? <HBarChart data={stats.intentDistribution} colorClass="bg-purple-500" maxItems={8} />
            : <p className="text-slate-500 text-xs text-center py-4">無意圖辨識資料</p>
          }
        </div>

      </div>
    </div>
  );
}
