import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { whatsappApi } from "../services/api";
import { Smartphone, CheckCircle, XCircle, RefreshCw, LogOut } from "lucide-react";

const WA_SOCKET_URL = "http://localhost:3003";

export default function WhatsAppSetup() {
  const [status, setStatus] = useState("disconnected"); // disconnected | connecting | ready
  const [phone, setPhone] = useState(null);
  const [qr, setQr] = useState(null);
  const [connectedAt, setConnectedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [waSocket, setWaSocket] = useState(null);

  useEffect(() => {
    // Fetch current status from backend proxy
    whatsappApi.status().then((r) => {
      setStatus(r.data.status || "disconnected");
      setPhone(r.data.phone || null);
      setConnectedAt(r.data.connected_at || null);
    }).catch(() => setStatus("disconnected"));

    // Direct socket to whatsapp-service for live QR
    const sock = io(WA_SOCKET_URL, { transports: ["websocket"] });
    setWaSocket(sock);

    sock.on("whatsapp:qr", ({ qr: qrData }) => {
      setQr(qrData);
      setStatus("connecting");
    });
    sock.on("whatsapp:ready", ({ phone: ph, connected_at }) => {
      setStatus("ready");
      setPhone(ph);
      setConnectedAt(connected_at);
      setQr(null);
    });
    sock.on("whatsapp:disconnected", () => {
      setStatus("disconnected");
      setPhone(null);
      setQr(null);
    });

    return () => sock.disconnect();
  }, []);

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await whatsappApi.disconnect();
      setStatus("disconnected");
      setPhone(null);
      setQr(null);
    } finally {
      setLoading(false);
    }
  };

  const StatusBadge = () => {
    if (status === "ready") return (
      <span className="flex items-center gap-1.5 text-green-400 font-medium">
        <CheckCircle size={16} /> Connected
      </span>
    );
    if (status === "connecting") return (
      <span className="flex items-center gap-1.5 text-yellow-400 font-medium">
        <RefreshCw size={16} className="animate-spin" /> Waiting for scan…
      </span>
    );
    return (
      <span className="flex items-center gap-1.5 text-gray-400 font-medium">
        <XCircle size={16} /> Disconnected
      </span>
    );
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Smartphone size={24} className="text-green-400" />
          WhatsApp Setup
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Link your WhatsApp to send real messages through campaigns.
        </p>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-gray-300 font-medium">Status</span>
          <StatusBadge />
        </div>

        {phone && (
          <div className="flex items-center justify-between">
            <span className="text-gray-300 font-medium">Phone</span>
            <span className="text-white font-mono">+{phone.replace("@s.whatsapp.net", "")}</span>
          </div>
        )}

        {connectedAt && (
          <div className="flex items-center justify-between">
            <span className="text-gray-300 font-medium">Connected at</span>
            <span className="text-gray-400 text-sm">{new Date(connectedAt).toLocaleString("en-IN")}</span>
          </div>
        )}
      </div>

      {status !== "ready" && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-white">Scan QR Code</h2>
          <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
            <li>Open WhatsApp on your phone</li>
            <li>Go to <strong className="text-gray-200">Settings → Linked Devices</strong></li>
            <li>Tap <strong className="text-gray-200">Link a Device</strong></li>
            <li>Scan the QR code below</li>
          </ol>

          <div className="flex justify-center">
            {qr ? (
              <div className="p-3 bg-white rounded-xl inline-block">
                <img src={qr} alt="WhatsApp QR Code" className="w-56 h-56" />
              </div>
            ) : (
              <div className="w-56 h-56 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center">
                {status === "disconnected" ? (
                  <p className="text-gray-500 text-sm text-center px-4">
                    Start whatsapp-service<br />(<code className="text-xs">npm run dev</code> in<br /><code className="text-xs">whatsapp-service/</code>)
                  </p>
                ) : (
                  <RefreshCw size={24} className="text-gray-500 animate-spin" />
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {status === "ready" && (
        <div className="card bg-green-900/20 border-green-700/40">
          <div className="flex items-start gap-3">
            <CheckCircle size={20} className="text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-green-300 font-medium">WhatsApp connected</p>
              <p className="text-green-400/70 text-sm mt-0.5">
                Campaigns with WhatsApp channel will now send real messages.
                Session is saved — reconnects automatically on restart.
              </p>
            </div>
          </div>
          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-red-900/40 border border-red-700/40 text-red-400 hover:bg-red-900/60 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <LogOut size={14} />
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
