import React, { useEffect, useState } from "react";
import { analyticsApi } from "../services/api";
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

export default function Analytics() {
  const [channelPerf, setChannelPerf] = useState([]);
  const [campaignPerf, setCampaignPerf] = useState([]);

  useEffect(() => {
    analyticsApi.channelPerformance().then((r) => setChannelPerf(r.data));
    analyticsApi.campaigns({ days: 60 }).then((r) => setCampaignPerf(r.data.slice(0, 10)));
  }, []);

  const radarData = channelPerf.map((c) => ({
    channel: c.channel,
    "Open Rate": c.open_rate?.toFixed(1),
    CTR: c.ctr?.toFixed(1),
    Conversion: c.conversion_rate?.toFixed(1),
  }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-gray-400 text-sm mt-0.5">Cross-campaign performance intelligence</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Channel performance radar */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4">Channel Performance</h2>
          {radarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#374151" />
                <PolarAngleAxis dataKey="channel" tick={{ fill: "#9ca3af", fontSize: 12 }} />
                <Radar name="Open Rate %" dataKey="Open Rate" stroke="#a855f7" fill="#a855f7" fillOpacity={0.2} />
                <Radar name="CTR %" dataKey="CTR" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                <Radar name="Conv %" dataKey="Conversion" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">No data</div>
          )}
        </div>

        {/* Top campaigns */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4">Top Campaigns by Open Rate</h2>
          {campaignPerf.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={campaignPerf} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 11 }} unit="%" />
                <YAxis
                  type="category"
                  dataKey="campaign_name"
                  tick={{ fill: "#9ca3af", fontSize: 10 }}
                  width={80}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }}
                />
                <Bar dataKey="open_rate" name="Open Rate %" fill="#a855f7" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">No data</div>
          )}
        </div>
      </div>
    </div>
  );
}
