const express = require("express");
const router = express.Router();
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const AgentLog = require("../models/AgentLog");

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

// POST /api/agent/task — dispatch NL query to AI service
router.post("/task", async (req, res, next) => {
  try {
    const { query, context } = req.body;
    if (!query) return res.status(400).json({ error: "query is required" });

    const session_id = uuidv4();

    // log the start
    await AgentLog.create({
      session_id,
      agent_name: "supervisor",
      step: "init",
      input_summary: query.slice(0, 200),
    });

    // emit to connected clients that agent started
    req.io.emit("agent:started", { session_id, query });

    // fire-and-forget to AI service; AI service will call back via WebSocket
    axios
      .post(`${AI_SERVICE_URL}/run`, {
        session_id,
        query,
        context: context || {},
        ws_callback: `http://localhost:${process.env.PORT || 3001}`,
      })
      .catch((err) => {
        console.error("AI service error:", err.message);
        req.io.emit("agent:error", { session_id, error: err.message });
      });

    res.status(202).json({ session_id, status: "started" });
  } catch (err) {
    next(err);
  }
});

// GET /api/agent/task/:session_id — get all logs for a session
router.get("/task/:session_id", async (req, res, next) => {
  try {
    const logs = await AgentLog.find({ session_id: req.params.session_id })
      .sort({ timestamp: 1 })
      .lean();
    res.json({ session_id: req.params.session_id, logs });
  } catch (err) {
    next(err);
  }
});

// POST /api/agent/task/:session_id/resume — resume after human approval
router.post("/task/:session_id/resume", async (req, res, next) => {
  try {
    const { approved } = req.body;
    await axios.post(`${AI_SERVICE_URL}/run/${req.params.session_id}/resume`, {
      approved,
    });
    res.json({ status: "resumed" });
  } catch (err) {
    next(err);
  }
});

// POST /api/agent/progress — called by AI service to relay progress (internal)
router.post("/progress", async (req, res) => {
  const { session_id, step, agent, message, data } = req.body;
  req.io.emit("agent:progress", { session_id, step, agent, message, data });

  // persist to agent log
  await AgentLog.create({
    session_id,
    agent_name: agent || "unknown",
    step,
    output_summary: message,
    tools_called: data?.tools_called || [],
    tokens_used: data?.tokens_used || 0,
    duration_ms: data?.duration_ms || 0,
  }).catch(console.error);

  res.status(200).json({ ok: true });
});

// POST /api/agent/completed — called by AI service when graph finishes
router.post("/completed", async (req, res) => {
  const { session_id, result } = req.body;
  req.io.emit("agent:completed", { session_id, result });
  res.status(200).json({ ok: true });
});

// GET /api/agent/stats — dashboard KPIs for agent panel
const KNOWN_AGENTS = [
  { id: "supervisor",        label: "Supervisor",          role: "Orchestrates the full pipeline" },
  { id: "segmentation",     label: "Segmentation",        role: "Builds smart customer segments" },
  { id: "campaign_creation",label: "Campaign Creator",    role: "Designs campaign plans" },
  { id: "personalization",  label: "Personalization",     role: "Crafts personalised messages" },
  { id: "channel_selection",label: "Channel Selector",    role: "Picks best delivery channel" },
  { id: "execution",        label: "Execution",           role: "Dispatches messages at scale" },
  { id: "analytics",        label: "Analytics",           role: "Measures campaign outcomes" },
  { id: "optimization",     label: "Optimization",        role: "Suggests performance improvements" },
  { id: "journey_builder",  label: "Journey Builder",     role: "Builds automated journeys" },
  { id: "human_approval",   label: "Human-in-the-Loop",   role: "Awaits operator approval" },
];

router.get("/stats", async (req, res, next) => {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // Sessions that had activity in the last 5 min = "live"
    const activeSessions = await AgentLog.distinct("session_id", {
      timestamp: { $gte: fiveMinutesAgo },
    });

    // Which agent names appeared in active sessions
    const activeAgentNames = await AgentLog.distinct("agent_name", {
      session_id: { $in: activeSessions },
    });
    const activeSet = new Set(activeAgentNames);

    // All-time unique agents that have ever run
    const everUsedAgents = await AgentLog.distinct("agent_name");
    const everUsedSet = new Set(everUsedAgents);

    // Total sessions ever
    const totalSessions = await AgentLog.distinct("session_id");

    // Per-agent last-seen
    const lastSeen = await AgentLog.aggregate([
      { $group: { _id: "$agent_name", lastRun: { $max: "$timestamp" }, runs: { $sum: 1 } } },
    ]);
    const lastSeenMap = {};
    lastSeen.forEach((a) => { lastSeenMap[a._id] = { lastRun: a.lastRun, runs: a.runs }; });

    const agents = KNOWN_AGENTS.map((a) => ({
      ...a,
      status: activeSet.has(a.id) ? "live" : everUsedSet.has(a.id) ? "idle" : "ready",
      runs: lastSeenMap[a.id]?.runs || 0,
      lastRun: lastSeenMap[a.id]?.lastRun || null,
    }));

    res.json({
      total_agents: KNOWN_AGENTS.length,
      live_agents: agents.filter((a) => a.status === "live").length,
      idle_agents: agents.filter((a) => a.status === "idle").length,
      ready_agents: agents.filter((a) => a.status === "ready").length,
      total_sessions: totalSessions.length,
      active_sessions: activeSessions.length,
      agents,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
