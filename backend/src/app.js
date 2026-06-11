require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const morgan = require("morgan");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const customerRoutes = require("./routes/customers");
const orderRoutes = require("./routes/orders");
const segmentRoutes = require("./routes/segments");
const campaignRoutes = require("./routes/campaigns");
const analyticsRoutes = require("./routes/analytics");
const agentRoutes = require("./routes/agent");
const webhookRoutes = require("./routes/webhooks");
const offersRoutes = require("./routes/offers");
const journeysRoutes = require("./routes/journeys");
const productsRoutes = require("./routes/products");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(cors());
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));

// attach io to req so routes can emit
app.use((req, _res, next) => {
  req.io = io;
  next();
});

app.use("/api/customers", customerRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/segments", segmentRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/agent", agentRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/offers", offersRoutes);
app.use("/api/journeys", journeysRoutes);
app.use("/api/products", productsRoutes);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  socket.on("disconnect", () => console.log("Client disconnected:", socket.id));
});

const PORT = process.env.PORT || 3001;

connectDB().then(() => {
  server.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
});

module.exports = { app, io };
