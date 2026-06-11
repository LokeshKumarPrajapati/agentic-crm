import React, { useEffect, useState } from "react";
import {
  Users, Megaphone, TrendingUp, MessageSquare, BarChart3, Zap, Target,
  Bot, Activity, Circle, RefreshCw, Cpu, GitBranch, Layers,
  ShoppingBag, Mail, Radio, Settings, PieChart, Sparkles, CheckCircle,
} from "lucide-react";
import { analyticsApi, agentApi, segmentsApi } from "../services/api";
import personasApi from "../services/personasApi";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart as RechartsPie, Pie, Cell,
} from "recharts";

// ─── KPI card ────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, color = "purple" }) {
  const colorMap = {
    purple: { bg: "bg-purple-600/20", text: "text-purple-400", ring: "ring-purple-500/30" },
    green:  { bg: "bg-green-600/20",  text: "text-green-400",  ring: "ring-green-500/30"  },
    blue:   { bg: "bg-blue-600/20",   text: "text-blue-400",   ring: "ring-blue-500/30"   },
    amber:  { bg: "bg-amber-600/20",  text: "text-amber-400",  ring: "ring-amber-500/30"  },
    rose:   { bg: "bg-rose-600/20",   text: "text-rose-400",   ring: "ring-rose-500/30"   },
  };
  const c = colorMap[color] || colorMap.purple;
  return (
    <div className={`bg-gray-800 rounded-xl border border-gray-700 p-4 flex items-start gap-4 ring-1 ${c.ring} transition-all hover:border-gray-600`}>
      <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={20} className={c.text} />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value ?? "—"}</p>
        <p className="text-sm text-gray-400">{label}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Agent status badge ───────────────────────────────────────────────────────
const STATUS_CONFIG = {
  live:   { dot: "bg-green-400",  ring: "ring-green-500/40",  badge: "text-green-400 bg-green-400/10",  label: "LIVE"  },
  idle:   { dot: "bg-amber-400",  ring: "ring-amber-500/40",  badge: "text-amber-400 bg-amber-400/10",  label: "IDLE"  },
  ready:  { dot: "bg-gray-400",   ring: "ring-gray-500/20",   badge: "text-gray-400 bg-gray-400/10",    label: "READY" },
};

const AGENT_ICONS = {
  supervisor:         Sparkles,
  segmentation:       PieChart,
  campaign_creation:  Megaphone,
  personalization:    MessageSquare,
  channel_selection:  Radio,
  execution:          Zap,
  analytics:          BarChart3,
  optimization:       TrendingUp,
  journey_builder:    GitBranch,
  human_approval:     CheckCircle,
};

function AgentCard({ agent }) {
  const cfg = STATUS_CONFIG[agent.status] || STATUS_CONFIG.ready;
  const Icon = AGENT_ICONS[agent.id] || Bot;

  return (
    <div className={`bg-gray-800/80 rounded-xl border border-gray-700 p-3 ring-1 ${cfg.ring} transition-all hover:border-gray-600 hover:bg-gray-800 flex flex-col gap-2`}>
      {/* Top row: icon + status badge */}
      <div className="flex items-center justify-between">
        <div className="w-8 h-8 rounded-lg bg-purple-600/20 flex items-center justify-center flex-shrink-0">
          <Icon size={15} className="text-purple-400" />
        </div>
        <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
          {agent.status === "live" ? (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
          ) : (
            <Circle size={5} className="fill-current" />
          )}
          {cfg.label}
        </span>
      </div>
      {/* Bottom: name + role */}
      <div>
        <p className="text-sm font-semibold text-white leading-tight">{agent.label}</p>
        <p className="text-xs text-gray-500 mt-0.5 leading-tight">{agent.role}</p>
        {agent.runs > 0 && (
          <p className="text-xs text-gray-600 mt-1">{agent.runs} run{agent.runs !== 1 ? "s" : ""}</p>
        )}
      </div>
    </div>
  );
}

// ─── Agent Fleet Panel ────────────────────────────────────────────────────────
function AgentFleetPanel() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchStats = () => {
    agentApi.stats()
      .then((r) => {
        setStats(r.data);
        setLastRefresh(new Date());
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10_000); // poll every 10 s
    return () => clearInterval(interval);
  }, []);

  const liveCount   = stats?.live_agents   ?? 0;
  const idleCount   = stats?.idle_agents   ?? 0;
  const readyCount  = stats?.ready_agents  ?? 0;
  const totalCount  = stats?.total_agents  ?? 10;
  const activeSessions = stats?.active_sessions ?? 0;
  const totalSessions  = stats?.total_sessions  ?? 0;

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-purple-600/20 flex items-center justify-center">
            <Cpu size={18} className="text-purple-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">AI Agent Fleet</h2>
            <p className="text-xs text-gray-500">LangGraph multi-agent pipeline</p>
          </div>
        </div>
        <button
          onClick={fetchStats}
          title="Refresh"
          className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 rounded-lg hover:bg-gray-700"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="bg-gray-900/60 rounded-lg p-3 text-center border border-gray-700">
          <p className="text-2xl font-bold text-white">{totalCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Agents</p>
        </div>
        <div className="bg-green-950/40 rounded-lg p-3 text-center border border-green-800/40">
          <p className="text-2xl font-bold text-green-400">{liveCount}</p>
          <div className="flex items-center justify-center gap-1 mt-0.5">
            {liveCount > 0 && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
              </span>
            )}
            <p className="text-xs text-green-500">Live Now</p>
          </div>
        </div>
        <div className="bg-amber-950/30 rounded-lg p-3 text-center border border-amber-800/30">
          <p className="text-2xl font-bold text-amber-400">{idleCount}</p>
          <p className="text-xs text-amber-600 mt-0.5">Idle</p>
        </div>
        <div className="bg-gray-900/60 rounded-lg p-3 text-center border border-gray-700">
          <p className="text-2xl font-bold text-gray-300">{readyCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Ready</p>
        </div>
      </div>

      {/* Sessions row */}
      <div className="flex items-center gap-3 mb-4 px-1">
        <Activity size={13} className="text-purple-400 flex-shrink-0" />
        <span className="text-xs text-gray-400">
          <span className="text-white font-semibold">{activeSessions}</span> active session{activeSessions !== 1 ? "s" : ""}
          <span className="mx-2 text-gray-600">·</span>
          <span className="text-white font-semibold">{totalSessions}</span> total runs
        </span>
        {lastRefresh && (
          <span className="ml-auto text-xs text-gray-600">
            Updated {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        )}
      </div>

      {/* Per-agent grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="bg-gray-700/40 rounded-xl h-20 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
          {(stats?.agents ?? []).map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
const RFM_COLORS = {
  Champions: "#a855f7", Loyal: "#3b82f6", "At Risk": "#f59e0b",
  "Cannot Lose": "#ef4444", Lost: "#6b7280", New: "#06b6d4", Potential: "#10b981",
};

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [campaignPerf, setCampaignPerf] = useState([]);
  const [segmentCount, setSegmentCount] = useState(null);
  const [rfmDist, setRfmDist] = useState([]);
  const [bizKpis, setBizKpis] = useState(null);

  useEffect(() => {
    analyticsApi.overview().then((r) => setOverview(r.data)).catch(() => {});
    analyticsApi.campaigns({ days: 30 }).then((r) => setCampaignPerf(r.data.slice(0, 8))).catch(() => {});
    analyticsApi.businessKpis().then((r) => setBizKpis(r.data)).catch(() => {});
    segmentsApi.list().then((r) => setSegmentCount(Array.isArray(r.data) ? r.data.length : 0)).catch(() => {});
    personasApi.distribution().then((d) => setRfmDist(d || [])).catch(() => {});
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">AI-Native Marketing CRM — Zari Fashion</p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Users}        label="Total Customers"  value={overview?.total_customers?.toLocaleString()} color="blue" />
        <KpiCard icon={MessageSquare}label="Messages Sent"    value={overview?.total_messages_sent?.toLocaleString()} color="purple" />
        <KpiCard icon={BarChart3}    label="Avg Open Rate"    value={`${overview?.overall_open_rate ?? 0}%`} color="green" />
        <KpiCard icon={TrendingUp}   label="Conversion Rate"  value={`${overview?.overall_conversion_rate ?? 0}%`} color="amber" />
      </div>

      {/* AI Agent Fleet Panel */}
      <AgentFleetPanel />

      {/* ROI banner — real computed values */}
      <div className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-purple-700/40 rounded-xl p-5">
        <div className="grid grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-3xl font-bold text-white">
              {bizKpis ? (bizKpis.avg_roi > 0 ? `${bizKpis.avg_roi}x` : "—") : "…"}
            </div>
            <div className="text-sm text-purple-300 mt-1">Avg Campaign ROI</div>
            {bizKpis?.total_converted > 0 && (
              <div className="text-xs text-purple-500 mt-0.5">
                {bizKpis.total_converted} conversions · ₹{bizKpis.est_revenue?.toLocaleString()} est. revenue
              </div>
            )}
          </div>
          <div>
            <div className="text-3xl font-bold text-white">
              {bizKpis ? (bizKpis.repeat_sales_pct > 0 ? `${bizKpis.repeat_sales_pct}%` : "—") : "…"}
            </div>
            <div className="text-sm text-purple-300 mt-1">Repeat Buyers</div>
            {bizKpis?.repeat_buyer_count > 0 && (
              <div className="text-xs text-purple-500 mt-0.5">
                {bizKpis.repeat_buyer_count?.toLocaleString()} customers · 2+ orders
              </div>
            )}
          </div>
          <div>
            <div className="text-3xl font-bold text-white">
              {bizKpis ? (bizKpis.vip_spend_multiplier > 0 ? `${bizKpis.vip_spend_multiplier}x` : "—") : "…"}
            </div>
            <div className="text-sm text-purple-300 mt-1">VIP vs Avg Spend</div>
            {bizKpis?.vip_customer_count > 0 && (
              <div className="text-xs text-purple-500 mt-0.5">
                {bizKpis.vip_customer_count} Gold/Platinum customers
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Campaign performance chart */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
        <h2 className="text-base font-semibold text-white mb-4">Campaign Performance (Last 30 days)</h2>
        {campaignPerf.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={campaignPerf} margin={{ top: 0, right: 10, bottom: 40, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="campaign_name"
                tick={{ fill: "#9ca3af", fontSize: 10 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }}
                labelStyle={{ color: "#f9fafb" }}
              />
              <Legend />
              <Bar dataKey="open_rate" name="Open Rate %" fill="#a855f7" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ctr"       name="CTR %"       fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="conversion_rate" name="Conv %" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-56 flex items-center justify-center text-gray-500 text-sm">
            No campaign data yet — run your first AI campaign from the Agent tab
          </div>
        )}
      </div>

      {/* Bottom stats row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard icon={Megaphone} label="Total Campaigns"  value={overview?.total_campaigns}  color="purple" />
        <KpiCard icon={Zap}       label="Active Campaigns" value={overview?.active_campaigns}  color="green"  />
        <KpiCard icon={Target}    label="Segments"         value={segmentCount ?? "—"}         color="blue"   sub={segmentCount == null ? "Loading..." : "active segments"} />
      </div>

      {/* RFM segment distribution mini chart */}
      {rfmDist.length > 0 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <h2 className="text-base font-semibold text-white mb-4">RFM Customer Segments</h2>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={200} height={160}>
              <RechartsPie>
                <Pie data={rfmDist} dataKey="count" nameKey="segment" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {rfmDist.map((d) => <Cell key={d.segment} fill={RFM_COLORS[d.segment] || "#6b7280"} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
                  formatter={(v, n) => [`${v} customers`, n]}
                />
              </RechartsPie>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 flex-1">
              {rfmDist.map((d) => (
                <div key={d.segment} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: RFM_COLORS[d.segment] || "#6b7280" }} />
                  <span className="text-gray-300 flex-1">{d.segment}</span>
                  <span className="text-gray-400 font-semibold">{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
