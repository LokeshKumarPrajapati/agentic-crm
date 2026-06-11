import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { customersApi } from "../services/api";

const TAG_COLORS = {
  vip: "bg-yellow-900/50 text-yellow-300 border-yellow-700/40",
  churned: "bg-red-900/50 text-red-300 border-red-700/40",
  "at-risk": "bg-orange-900/50 text-orange-300 border-orange-700/40",
  active: "bg-green-900/50 text-green-300 border-green-700/40",
  loyal: "bg-blue-900/50 text-blue-300 border-blue-700/40",
  champion: "bg-purple-900/50 text-purple-300 border-purple-700/40",
  "one-time": "bg-gray-700/50 text-gray-400 border-gray-600/40",
  "high-value": "bg-emerald-900/50 text-emerald-300 border-emerald-700/40",
  new: "bg-cyan-900/50 text-cyan-300 border-cyan-700/40",
};

const CHANNEL_ICONS = { whatsapp: "💬", email: "📧", sms: "📱", rcs: "🔔" };

function Tag({ label }) {
  const cls = TAG_COLORS[label] || "bg-gray-700/50 text-gray-400 border-gray-600/40";
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>;
}

function Customer360Card({ customer, onClose }) {
  const churnScore = customer.churn_score || 0;
  const churnColor = churnScore > 0.6 ? "text-red-400" : churnScore > 0.3 ? "text-yellow-400" : "text-green-400";
  const churnLabel = churnScore > 0.6 ? "High" : churnScore > 0.3 ? "Medium" : "Low";

  return (
    <div className="bg-gray-800 rounded-2xl border border-purple-600/40 p-5 shadow-2xl shadow-purple-900/20 relative">
      <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white">
        <X size={16} />
      </button>

      <div className="mb-4">
        <h3 className="text-white font-bold text-lg">{customer.name}</h3>
        <p className="text-gray-400 text-sm">{customer.email}</p>
        {customer.phone && <p className="text-gray-500 text-xs mt-0.5">{customer.phone}</p>}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4 bg-gray-900 rounded-xl p-3">
        <div className="text-center">
          <div className="text-white font-bold text-lg">₹{(customer.ltv || 0).toLocaleString()}</div>
          <div className="text-xs text-gray-500">LTV</div>
        </div>
        <div className="text-center border-x border-gray-700">
          <div className="text-white font-bold text-lg">{customer.total_orders || 0}</div>
          <div className="text-xs text-gray-500">Orders</div>
        </div>
        <div className="text-center">
          <div className={`font-bold text-lg ${churnColor}`}>{churnLabel}</div>
          <div className="text-xs text-gray-500">Churn Risk</div>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between bg-gray-900 rounded-lg px-3 py-2">
          <span className="text-gray-400 text-sm">Avg Order</span>
          <span className="text-white text-sm font-medium">₹{(customer.avg_order_value || 0).toLocaleString()}</span>
        </div>
        {customer.last_purchase_at && (
          <div className="flex items-center justify-between bg-gray-900 rounded-lg px-3 py-2">
            <span className="text-gray-400 text-sm">Last Purchase</span>
            <span className="text-white text-sm font-medium">
              {new Date(customer.last_purchase_at).toLocaleDateString("en-IN")}
            </span>
          </div>
        )}
        {customer.predicted_next_category && (
          <div className="flex items-center justify-between bg-gray-900 rounded-lg px-3 py-2">
            <span className="text-gray-400 text-sm">Next Category</span>
            <span className="text-purple-300 text-sm font-medium">{customer.predicted_next_category}</span>
          </div>
        )}
        {(customer.channel_preferences) && (
          <div className="flex items-center justify-between bg-gray-900 rounded-lg px-3 py-2">
            <span className="text-gray-400 text-sm">Channels</span>
            <div className="flex gap-1">
              {Object.entries(customer.channel_preferences)
                .filter(([, v]) => v)
                .map(([ch]) => (
                  <span key={ch} title={ch}>{CHANNEL_ICONS[ch] || ch}</span>
                ))}
            </div>
          </div>
        )}
      </div>

      {customer.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {customer.tags.map((t) => <Tag key={t} label={t} />)}
        </div>
      )}
    </div>
  );
}

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  useEffect(() => {
    customersApi.list({ page, limit: 20 }).then((r) => {
      setCustomers(r.data.customers);
      setTotal(r.data.total);
    });
  }, [page]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Customers</h1>
          <p className="text-gray-400 text-sm mt-0.5">{total.toLocaleString()} total</p>
        </div>
        <p className="text-xs text-gray-500">Click any row for Customer 360 view</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className={selectedCustomer ? "xl:col-span-2" : "xl:col-span-3"}>
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  {["Name", "LTV", "Orders", "Last Purchase", "Tags", "Churn"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr
                    key={c._id}
                    onClick={() => setSelectedCustomer(selectedCustomer?._id === c._id ? null : c)}
                    className={`border-b border-gray-700/50 cursor-pointer transition-colors ${
                      selectedCustomer?._id === c._id ? "bg-purple-900/20" : "hover:bg-gray-700/30"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{c.name}</div>
                      <div className="text-xs text-gray-500">{c.email}</div>
                    </td>
                    <td className="px-4 py-3 text-white">₹{(c.ltv || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-white">{c.total_orders}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {c.last_purchase_at
                        ? new Date(c.last_purchase_at).toLocaleDateString("en-IN")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(c.tags || []).slice(0, 2).map((t) => <Tag key={t} label={t} />)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-700 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              (c.churn_score || 0) > 0.7 ? "bg-red-500" : (c.churn_score || 0) > 0.4 ? "bg-amber-500" : "bg-green-500"
                            }`}
                            style={{ width: `${(c.churn_score || 0) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{Math.round((c.churn_score || 0) * 100)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-400">Page {page} · {total.toLocaleString()} customers</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 text-sm disabled:opacity-40 hover:bg-gray-700 transition-colors"
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={customers.length < 20}
                className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 text-sm disabled:opacity-40 hover:bg-gray-700 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        </div>

        {selectedCustomer && (
          <div className="xl:col-span-1">
            <Customer360Card
              customer={selectedCustomer}
              onClose={() => setSelectedCustomer(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
