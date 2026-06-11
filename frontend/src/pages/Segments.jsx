import React, { useEffect, useState } from "react";
import { PieChart, RefreshCw, Bot } from "lucide-react";
import { segmentsApi } from "../services/api";

export default function Segments() {
  const [segments, setSegments] = useState([]);

  useEffect(() => {
    segmentsApi.list().then((r) => setSegments(r.data));
  }, []);

  const refresh = async (id) => {
    await segmentsApi.refresh(id);
    segmentsApi.list().then((r) => setSegments(r.data));
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Segments</h1>
        <p className="text-gray-400 text-sm mt-0.5">{segments.length} segments</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {segments.length === 0 && (
          <div className="card col-span-3 text-center py-10 text-gray-500">
            No segments yet. Use the AI Agent to create a targeted audience.
          </div>
        )}
        {segments.map((s) => (
          <div key={s._id} className="card space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-white">{s.name}</h3>
                {s.description && (
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{s.description}</p>
                )}
              </div>
              <button
                onClick={() => refresh(s._id)}
                className="text-gray-500 hover:text-gray-300 transition-colors"
                title="Refresh segment"
              >
                <RefreshCw size={14} />
              </button>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div>
                <p className="text-xl font-bold text-white">{s.size?.toLocaleString()}</p>
                <p className="text-xs text-gray-400">customers</p>
              </div>
              {s.created_by === "agent:segmentation" && (
                <span className="badge bg-brand-900/40 text-brand-300 border border-brand-700/30 flex items-center gap-1">
                  <Bot size={10} />
                  AI Created
                </span>
              )}
            </div>

            {s.criteria_nl && (
              <div className="bg-gray-800/50 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-400 italic">"{s.criteria_nl}"</p>
              </div>
            )}

            {s.last_refreshed_at && (
              <p className="text-xs text-gray-600">
                Last refreshed: {new Date(s.last_refreshed_at).toLocaleString("en-IN")}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
