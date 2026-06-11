import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  PieChart,
  Megaphone,
  BarChart3,
  Bot,
  Sparkles,
  Menu,
  X,
  GitBranch,
  Tag,
} from "lucide-react";

const CRM_NAV = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/customers", icon: Users, label: "Customers" },
  { to: "/segments", icon: PieChart, label: "Segments" },
  { to: "/campaigns", icon: Megaphone, label: "Campaigns" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
];

const OFFERS_NAV = [
  { to: "/offers", icon: Tag, label: "Offers" },
];

const AUTOMATION_NAV = [
  { to: "/journeys", icon: GitBranch, label: "Journey Builder" },
  { to: "/agent", icon: Bot, label: "AI Agent" },
];

function NavSection({ label, items, collapsed }) {
  return (
    <div>
      {!collapsed && (
        <div className="px-3 pt-4 pb-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
        </div>
      )}
      {collapsed && <div className="border-t border-gray-800 my-2" />}
      {items.map(({ to, icon: Icon, label: itemLabel }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-purple-600 text-white"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
            }`
          }
        >
          <Icon size={18} className="flex-shrink-0" />
          {!collapsed && <span>{itemLabel}</span>}
        </NavLink>
      ))}
    </div>
  );
}

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      {/* Sidebar */}
      <aside
        className={`flex flex-col bg-gray-900 border-r border-gray-800 transition-all duration-200 ${
          collapsed ? "w-16" : "w-56"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-800">
          <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center flex-shrink-0">
            <Sparkles size={16} className="text-white" />
          </div>
          {!collapsed && (
            <span className="font-bold text-lg text-white">Zari CRM</span>
          )}
          <button
            className="ml-auto text-gray-500 hover:text-gray-300"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <Menu size={18} /> : <X size={18} />}
          </button>
        </div>

        {/* Nav pillars */}
        <nav className="flex-1 py-2 space-y-0.5 px-2 overflow-y-auto">
          <NavSection label="CRM" items={CRM_NAV} collapsed={collapsed} />
          <NavSection label="Offers" items={OFFERS_NAV} collapsed={collapsed} />
          <NavSection label="Automation" items={AUTOMATION_NAV} collapsed={collapsed} />
        </nav>

        {/* AI badge */}
        {!collapsed && (
          <div className="px-4 pb-4">
            <div className="rounded-lg bg-purple-900/40 border border-purple-700/40 p-3">
              <p className="text-xs text-purple-300 font-medium">Powered by</p>
              <p className="text-xs text-purple-400">Gemini 2.0 Flash + LangGraph</p>
            </div>
          </div>
        )}
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
