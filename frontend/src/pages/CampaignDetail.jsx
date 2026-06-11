import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { campaignsApi } from "../services/api";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";

const FUNNEL_COLORS = ["#a855f7", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

export default function CampaignDetail() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    campaignsApi.get(id).then((r) => setCampaign(r.data));
    campaignsApi.getAnalytics(id).then((r) => setAnalytics(r.data));
  }, [id]);

  if (!campaign) return <div className="p-6 text-gray-400">Loading...</div>;

  const funnel = analytics?.funnel || {};
  const funnelData = [
    { name: "Sent", value: funnel.sent || 0 },
    { name: "Delivered", value: funnel.delivered || 0 },
    { name: "Opened", value: funnel.opened || 0 },
    { name: "Clicked", value: funnel.clicked || 0 },
    { name: "Converted", value: funnel.converted || 0 },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{campaign.name}</h1>
        <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
          <span className="capitalize">{campaign.goal}</span>
          <span>·</span>
          <span>{campaign.channel}</span>
          <span>·</span>
          <span className="capitalize">{campaign.status}</span>
          {campaign.created_by_agent && (
            <span className="badge bg-brand-900/40 text-brand-300 border border-brand-700/30">AI Generated</span>
          )}
        </div>
      </div>

      {/* Funnel */}
      <div className="card">
        <h2 className="font-semibold text-white mb-4">Delivery Funnel</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={funnelData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 12 }} />
            <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }}
              labelStyle={{ color: "#f9fafb" }}
            />
            <Bar dataKey="value" name="Count" fill="#a855f7" radius={[4, 4, 0, 0]}>
              {funnelData.map((_, i) => (
                <Cell key={i} fill={FUNNEL_COLORS[i]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Rate badges */}
        <div className="flex flex-wrap gap-4 mt-4">
          {[
            { label: "Delivery Rate", val: funnel.delivered_rate },
            { label: "Open Rate", val: funnel.open_rate },
            { label: "CTR", val: funnel.ctr },
            { label: "Conversion", val: funnel.conversion_rate },
          ].map(({ label, val }) => (
            <div key={label} className="text-center">
              <p className="text-xl font-bold text-white">{val ? `${val.toFixed(1)}%` : "—"}</p>
              <p className="text-xs text-gray-400">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Insights */}
      {analytics?.insights_text && (
        <div className="card bg-brand-900/20 border-brand-700/40">
          <h2 className="font-semibold text-brand-300 mb-2">AI Insights</h2>
          <p className="text-sm text-gray-300 whitespace-pre-line">{analytics.insights_text}</p>
        </div>
      )}

      {/* Variants */}
      {campaign.copy_variants?.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-white mb-4">Copy Variants</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {campaign.copy_variants.map((v) => (
              <div
                key={v.variant_id}
                className={`p-4 rounded-lg border ${
                  v.is_winner
                    ? "border-green-600/50 bg-green-900/10"
                    : "border-gray-700 bg-gray-800/50"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-white">Variant {v.variant_id}</span>
                  {v.is_winner && (
                    <span className="badge bg-green-900/50 text-green-300 border border-green-700/40">Winner</span>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-200">{v.headline}</p>
                <p className="text-sm text-gray-400 mt-1">{v.body}</p>
                <p className="text-xs text-brand-400 mt-2">CTA: {v.cta}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
