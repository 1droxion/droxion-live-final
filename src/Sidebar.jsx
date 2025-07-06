// ✅ Sidebar.jsx – Droxion Final Sidebar (Compact + White Icons + Options)

import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  MessageSquare,
  RefreshCcw,
  CircleDot,
  Volume2,
  VolumeX
} from "lucide-react";

function Sidebar({ isOpen, setIsOpen, onNewChat, voiceMode, setVoiceMode, darkMode, setDarkMode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = window.innerWidth < 768;

  const handleNavClick = (path) => {
    navigate(path);
    if (isMobile) setIsOpen(false);
  };

  const routes = [
    { path: "/chatboard", icon: MessageSquare, label: "AI Chat" },
    { path: "#", icon: RefreshCcw, label: "New Chat", action: onNewChat },
  ];

  return (
    <aside
      className={`${
        isOpen ? "w-48" : "w-0"
      } bg-[#111] transition-all duration-300 overflow-hidden shadow-xl border-r border-gray-800 fixed md:static z-50 h-full`}
    >
      <div className="h-full flex flex-col p-3 space-y-2">
        <h2 className="text-xl font-bold text-white mb-4">🚀 Droxion</h2>
        {routes.map((route) => {
          const isActive = location.pathname === route.path;
          const Icon = route.icon;

          return (
            <button
              key={route.label}
              onClick={() => {
                if (route.action) route.action();
                else handleNavClick(route.path);
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded hover:bg-[#222] transition text-sm ${
                isActive ? "bg-white text-black" : "text-white"
              }`}
            >
              <Icon size={18} color="white" />
              <span>{route.label}</span>
            </button>
          );
        })}

        <hr className="border-gray-700 my-2" />

        <button
          onClick={() => setDarkMode(!darkMode)}
          className="flex items-center gap-2 px-3 py-2 rounded hover:bg-[#222] transition text-white text-sm"
        >
          <CircleDot size={18} color="white" />
          {darkMode ? "Light Mode" : "Dark Mode"}
        </button>

        <button
          onClick={() => setVoiceMode(!voiceMode)}
          className="flex items-center gap-2 px-3 py-2 rounded hover:bg-[#222] transition text-white text-sm"
        >
          {voiceMode ? <Volume2 size={18} color="white" /> : <VolumeX size={18} color="white" />} {voiceMode ? "Speaker On" : "Speaker Off"}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
