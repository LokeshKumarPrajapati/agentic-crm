import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Megaphone, Zap, Clock, CheckCircle, XCircle } from "lucide-react";
import { campaignsApi } from "../services/api";

const STATUS_STYLE = {
  draft: "bg-gray-700/50 text-gray-300",
  running: "bg-green-900/50 text-green-300",
  completed: "bg-blue-900/50 text-blue-300",
  failed: "bg-red-900/50 text-red-300",
  paused: "bg-amber-900/50 text-amber-300",
  scheduled: "bg-purple-900/50 text-purple-300",
};

const GOAL_EMOJI = {
  "re-engage": "🔄",
  upsell: "⬆️",
  loyalty: "💎",
  announce: "📢",
  winback: "🏆",
};

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [total, setTotal] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    campaignsApi.list({ limit: 30 }).then((r) => {
      setCampaigns(r.data.campaigns);
      setTotal(r.data.total);
    });
  }, []);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Campaigns</h1>
          <p className="text-gray-400 text-sm mt-0.5">{total} campaigns</p>
        </div>
        <button
          className="btn-primary flex items-center gap-2"
          onClick={() => navigate("/agent")}
        >
          <Zap size={16} />
          Create with AI
        </button>
      </div>

      <div className="grid gap-4">
        {campaigns.length === 0 && (
          <div className="card text-center py-12 text-gray-500">
            No campaigns yet. Use the AI Agent to create your first campaign.
          </div>
        )}
        {campaigns.map((c) => (
          <div
            key={c._id}
            className="card cursor-pointer hover:border-gray-700 transition-colors"
            onClick={() => navigate(`/campaigns/${c._id}`)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span>{GOAL_EMOJI[c.goal] || "📣"}</span>
                  <h3 className="font-semibold text-white truncate">{c.name}</h3>
                  <span className={`badge ${STATUS_STYLE[c.status]}`}>{c.status}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>📡 {c.channel}</span>
                  <span>🎯 {c.segment_id?.name || "—"} ({c.segment_id?.size?.toLocaleString() || "?"} customers)</span>
                  <span>📅 {new Date(c.created_at).toLocaleDateString("en-IN")}</span>
                  {c.created_by_agent && (
                    <span className="badge bg-brand-900/40 text-brand-300 border border-brand-700/30">AI Generated</span>
                  )}
                </div>
              </div>

              {/* Mini funnel */}
              <div className="flex items-center gap-4 text-sm flex-shrink-0">
                <div className="text-center">
                  <p className="font-semibold text-white">{c.metrics_summary?.sent || 0}</p>
                  <p className="text-xs text-gray-500">Sent</p>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-blue-400">{c.metrics_summary?.opened || 0}</p>
                  <p className="text-xs text-gray-500">Opened</p>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-green-400">{c.metrics_summary?.converted || 0}</p>
                  <p className="text-xs text-gray-500">Converted</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
