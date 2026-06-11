require("dotenv").config();
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const QRCode = require("qrcode");
const path = require("path");

const AUTH_FOLDER = process.env.AUTH_FOLDER || "./auth_info_baileys";

let sock = null;
let currentQR = null;
let status = "disconnected"; // disconnected | connecting | ready
let connectedPhone = null;
let connectedAt = null;
let _io = null; // socket.io instance injected after init

function setIo(io) {
  _io = io;
}

function getStatus() {
  return { status, phone: connectedPhone, connected_at: connectedAt, has_qr: !!currentQR };
}

function getQR() {
  return currentQR;
}

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  // Indian numbers: 10 digits → prepend 91
  const e164 = digits.length === 10 ? `91${digits}` : digits;
  return `${e164}@s.whatsapp.net`;
}

async function sendMessage(phone, text) {
  if (status !== "ready" || !sock) {
    throw new Error("WhatsApp not connected");
  }
  const jid = normalizePhone(phone);
  if (!jid) throw new Error("Invalid phone number");
  const result = await sock.sendMessage(jid, { text });
  return { success: true, message_id: result?.key?.id };
}

async function disconnect() {
  if (sock) {
    await sock.logout();
    sock = null;
  }
  status = "disconnected";
  connectedPhone = null;
  currentQR = null;
  if (_io) _io.emit("whatsapp:disconnected");
}

async function initClient() {
  const { state, saveCreds } = await useMultiFileAuthState(
    path.resolve(AUTH_FOLDER)
  );
  const { version } = await fetchLatestBaileysVersion();

  status = "connecting";

  sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
    },
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["Zari CRM", "Chrome", "1.0.0"],
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      // Generate base64 QR image
      const qrBase64 = await QRCode.toDataURL(qr);
      currentQR = qrBase64;
      if (_io) _io.emit("whatsapp:qr", { qr: qrBase64 });
      console.log("[WA] New QR code generated — scan with WhatsApp");
    }

    if (connection === "open") {
      status = "ready";
      currentQR = null;
      connectedPhone = sock.user?.id?.split(":")[0] || sock.user?.id;
      connectedAt = new Date().toISOString();
      console.log(`[WA] Connected as ${connectedPhone}`);
      if (_io) _io.emit("whatsapp:ready", { phone: connectedPhone, connected_at: connectedAt });
    }

    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      console.log(`[WA] Connection closed (code ${code}), reconnect: ${shouldReconnect}`);
      status = "disconnected";
      if (_io) _io.emit("whatsapp:disconnected", { code });
      if (shouldReconnect) {
        setTimeout(initClient, 3000); // auto-reconnect after 3s
      } else {
        sock = null;
        currentQR = null;
        connectedPhone = null;
      }
    }
  });

  // Track message delivery receipts
  sock.ev.on("messages.update", (updates) => {
    for (const update of updates) {
      if (update.update?.status && _io) {
        _io.emit("whatsapp:message_status", {
          message_id: update.key.id,
          status: update.update.status, // 1=pending, 2=server, 3=delivered, 4=read
          to: update.key.remoteJid,
        });
      }
    }
  });
}

module.exports = { initClient, sendMessage, disconnect, getStatus, getQR, setIo };
