require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const morgan = require("morgan");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");

const {
  initClient,
  sendMessage,
  disconnect,
  getStatus,
  getQR,
  setIo,
} = require("./client");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

// Inject socket.io into WA client so it can push QR/status events
setIo(io);

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /status — connection status
app.get("/status", (_req, res) => {
  res.json(getStatus());
});

// GET /qr — latest QR code as base64 data URL
app.get("/qr", (_req, res) => {
  const qr = getQR();
  const st = getStatus();
  if (st.status === "ready") {
    return res.json({ status: "ready", phone: st.phone });
  }
  if (!qr) {
    return res.json({ status: st.status, qr: null, message: "No QR available yet" });
  }
  res.json({ status: "qr", qr });
});

// POST /send — send single message
app.post("/send", async (req, res) => {
  const { to, message, message_id } = req.body;
  if (!to || !message) {
    return res.status(400).json({ error: "to and message are required" });
  }
  const msgId = message_id || uuidv4();
  try {
    const result = await sendMessage(to, message);
    res.json({ success: true, message_id: msgId, wa_id: result.message_id });
  } catch (err) {
    // Return error but don't crash — let caller fall back to simulation
    res.status(503).json({ success: false, error: err.message, message_id: msgId });
  }
});

// POST /send/batch — batch sends
app.post("/send/batch", async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array required" });
  }
  const results = await Promise.allSettled(
    messages.map(async (msg) => {
      const msgId = msg.message_id || uuidv4();
      try {
        const r = await sendMessage(msg.to, msg.message);
        return { success: true, message_id: msgId, wa_id: r.message_id };
      } catch (err) {
        return { success: false, message_id: msgId, error: err.message };
      }
    })
  );
  res.json({
    results: results.map((r) => (r.status === "fulfilled" ? r.value : { success: false, error: r.reason?.message })),
    count: messages.length,
  });
});

// POST /disconnect — logout + clear session
app.post("/disconnect", async (_req, res) => {
  try {
    await disconnect();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/health", (_req, res) => res.json({ status: "ok", wa: getStatus() }));

// ── Socket.io ─────────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  const st = getStatus();
  // Send current state immediately on connect
  if (st.status === "ready") {
    socket.emit("whatsapp:ready", { phone: st.phone, connected_at: st.connected_at });
  } else {
    const qr = getQR();
    if (qr) socket.emit("whatsapp:qr", { qr });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3003;
server.listen(PORT, async () => {
  console.log(`WhatsApp service running on port ${PORT}`);
  try {
    await initClient();
  } catch (err) {
    console.error("[WA] Failed to init client:", err.message);
  }
});
