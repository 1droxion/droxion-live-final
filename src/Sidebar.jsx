import React from "react";
import { NavLink } from "react-router-dom";
import {
  Home, LayoutDashboard, BotMessageSquare, Sparkles, BadgeDollarSign,
  Image as ImageIcon, Video, User, Settings, FileText, Book, Rocket, Wand2
} from "lucide-react";

function Sidebar() {
  const navItems = [
    { to: "/landing", icon: <Home size={20} />, label: "Landing" },
    { to: "/dashboard", icon: <LayoutDashboard size={20} />, label: "Dashboard" },
    { to: "/generator", icon: <Video size={20} />, label: "Generator" },
    { to: "/auto-generator", icon: <Sparkles size={20} />, label: "Auto Generator" },
    { to: "/chatboard", icon: <BotMessageSquare size={20} />, label: "AI Chat" },
    { to: "/ai-image", icon: <ImageIcon size={20} />, label: "AI Image" },
    { to: "/plans", icon: <BadgeDollarSign size={20} />, label: "Plans" },
    { to: "/projects", icon: <Book size={20} />, label: "Projects" },
    { to: "/templates", icon: <FileText size={20} />, label: "Templates" },
    { to: "/connect", icon: <Rocket size={20} />, label: "Connect" },
    { to: "/editor", icon: <Wand2 size={20} />, label: "Editor" },
    { to: "/profile", icon: <User size={20} />, label: "Profile" },
    { to: "/settings", icon: <Settings size={20} />, label: "Settings" }
  ];

  return (
    <div className="fixed top-0 right-0 h-full w-64 bg-[#111827] shadow-lg border-l border-gray-700 p-4 overflow-y-auto z-50">
      <div className="text-white text-2xl font-bold mb-6 text-center">DROXION</div>
      <nav className="flex flex-col gap-3">
        {navItems.map((item, idx) => (
          <NavLink
            key={idx}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2 rounded hover:bg-gray-700 ${
                isActive ? "bg-gray-700 text-white" : "text-gray-300"
              }`
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default Sidebar;
