import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { agentApi } from "../services/api";
import useAgentStore from "../store/agentStore";

const EXAMPLE_QUERIES = [
  "Re-engage VIP customers who haven't bought in 60 days with a 15% upsell offer on Email",
  "Set up a welcome journey for new customers with a first-purchase incentive",
  "Find high-value customers (Champions segment) interested in Ethnic Wear and create a Diwali collection campaign",
  "Analyze the performance of all campaigns from last month and suggest optimizations",
  "Send a winback campaign to churned customers with a 20% discount via WhatsApp",
];

function AgentEvent({ event }) {
  const icons = {
    supervisor: "🧠",
    segmentation: "🎯",
    campaign_creation: "✍️",
    personalization: "👤",
    channel_selection: "📡",
    execution: "🚀",
    analytics: "📊",
    optimization: "⚡",
    human_approval: "⏸️",
    persona_agent: "🪪",
    journey_builder: "🗺️",
    system: "⚙️",
  };

  return (
    <div className="flex gap-3 py-2">
      <div className="w-7 h-7 rounded-full bg-purple-900/50 border border-purple-700/40 flex items-center justify-center text-sm flex-shrink-0 mt-0.5">
        {icons[event.agent] || "🤖"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-purple-400 capitalize">
            {event.agent?.replace(/_/g, " ") || "agent"}
          </span>
          <span className="text-xs text-gray-600">
            {new Date(event.ts).toLocaleTimeString()}
          </span>
        </div>
        <p className="text-sm text-gray-300 mt-0.5">{event.message}</p>
        {event.data?.size && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900/50 text-purple-300 border border-purple-700/40 mt-1">
            {event.data.size} customers
          </span>
        )}
        {event.data?.metrics && (
          <div className="mt-2 flex gap-3 text-xs">
            <span className="text-gray-400">Open: <span className="text-white">{event.data.metrics.open_rate}%</span></span>
            <span className="text-gray-400">CTR: <span className="text-white">{event.data.metrics.ctr}%</span></span>
            <span className="text-gray-400">Conv: <span className="text-white">{event.data.metrics.conversion_rate}%</span></span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AgentChat() {
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const bottomRef = useRef(null);
  const { sessions, activeSessionId, startSession, getActiveSession } = useAgentStore();
  const activeSession = getActiveSession();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.events?.length]);

  const handleSubmit = async (query) => {
    const q = query || input.trim();
    if (!q || submitting) return;
    setInput("");
    setSubmitting(true);

    try {
      const { data } = await agentApi.runTask(q);
      startSession(data.session_id, q);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproval = async (approved) => {
    if (!activeSessionId) return;
    await agentApi.resumeTask(activeSessionId, approved);
    useAgentStore.getState().addEvent(activeSessionId, {
      type: "progress",
      agent: "system",
      message: approved ? "Campaign approved — executing..." : "Campaign cancelled by marketer",
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Bot size={22} className="text-brand-400" />
          AI Marketing Agent
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">Describe your campaign goal in plain English</p>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat / Events pane */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-2">
            {!activeSession && (
              <div className="text-center py-12">
                <Bot size={48} className="text-gray-700 mx-auto mb-4" />
                <p className="text-gray-400 mb-6">Start by describing what you want to achieve</p>
                <div className="space-y-2 max-w-lg mx-auto">
                  {EXAMPLE_QUERIES.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSubmit(q)}
                      className="w-full text-left text-sm text-gray-300 bg-gray-900 hover:bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeSession && (
              <div className="space-y-1">
                {/* User query */}
                <div className="flex gap-3 py-2 mb-4">
                  <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <User size={14} />
                  </div>
                  <div className="bg-gray-800 rounded-xl px-4 py-2 max-w-2xl">
                    <p className="text-sm text-white">{activeSession.query}</p>
                  </div>
                </div>

                {/* Agent events */}
                <div className="border-l-2 border-brand-700/30 pl-4 ml-3">
                  {activeSession.events.map((event, i) => (
                    <AgentEvent key={i} event={event} />
                  ))}

                  {activeSession.status === "running" && (
                    <div className="flex items-center gap-2 py-2 text-sm text-gray-400">
                      <Loader2 size={14} className="animate-spin text-brand-400" />
                      Thinking...
                    </div>
                  )}

                  {activeSession.status === "awaiting_approval" && (
                    <div className="my-4 p-4 bg-amber-900/20 border border-amber-700/40 rounded-lg">
                      <p className="text-amber-300 font-medium text-sm mb-3">
                        ⏸️ Approval Required — Large campaign detected
                      </p>
                      <p className="text-gray-400 text-xs mb-3">
                        This campaign will reach 1000+ customers. Confirm to proceed.
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => handleApproval(true)} className="btn-primary text-sm py-1.5">
                          Approve & Send
                        </button>
                        <button onClick={() => handleApproval(false)} className="btn-secondary text-sm py-1.5">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {activeSession.status === "completed" && activeSession.result && (
                    <div className="my-4 p-4 bg-green-900/20 border border-green-700/40 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 size={16} className="text-green-400" />
                        <p className="text-green-300 font-medium text-sm">Campaign Complete</p>
                      </div>
                      <p className="text-gray-300 text-sm">{activeSession.result.summary}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-800">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="Describe your campaign goal..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
                disabled={submitting || activeSession?.status === "running"}
              />
              <button
                onClick={() => handleSubmit()}
                disabled={!input.trim() || submitting || activeSession?.status === "running"}
                className="btn-primary px-4 py-3 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
