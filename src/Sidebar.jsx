// ✅ Sidebar.jsx – Droxion (Small, White/Black Icons, Auto Close, Chat History)

import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  MessageSquare,
  RefreshCcw,
  CircleDot,
  Volume2,
  VolumeX,
  Trash2
} from "lucide-react";

function Sidebar({
  isOpen,
  setIsOpen,
  onNewChat,
  voiceMode,
  setVoiceMode,
  darkMode,
  setDarkMode
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);

  const isMobile = window.innerWidth < 768;

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("chat_history")) || [];
    setHistory(stored);
  }, []);

  const handleNavClick = (path) => {
    navigate(path);
    if (isMobile) setIsOpen(false);
  };

  const addHistory = (title) => {
    const updated = [title, ...history.filter((item) => item !== title)].slice(0, 10);
    setHistory(updated);
    localStorage.setItem("chat_history", JSON.stringify(updated));
  };

  const deleteHistory = (title) => {
    const updated = history.filter((item) => item !== title);
    setHistory(updated);
    localStorage.setItem("chat_history", JSON.stringify(updated));
  };

  const handleNewChatClick = () => {
    onNewChat();
    if (isMobile) setIsOpen(false);
  };

  const routes = [
    { path: "/chatboard", icon: MessageSquare, label: "AI Chat" },
  ];

  return (
    <aside
      className={`${
        isOpen ? "w-44" : "w-0"
      } bg-[#111] transition-all duration-300 overflow-hidden shadow-xl border-r border-gray-800 fixed md:static z-50 h-full`}
    >
      <div className="h-full flex flex-col p-3 space-y-2">
        <h2 className="text-lg font-bold text-white mb-3">🚀 Droxion</h2>

        {routes.map((route) => {
          const isActive = location.pathname === route.path;
          const Icon = route.icon;

          return (
            <button
              key={route.label}
              onClick={() => handleNavClick(route.path)}
              className={`flex items-center gap-2 px-3 py-2 rounded hover:bg-[#222] transition text-sm ${
                isActive ? "bg-white text-black" : "text-white"
              }`}
            >
              <Icon size={18} color="white" />
              <span>{route.label}</span>
            </button>
          );
        })}

        <button
          onClick={handleNewChatClick}
          className="flex items-center gap-2 px-3 py-2 rounded hover:bg-[#222] text-white text-sm"
        >
          <RefreshCcw size={18} color="white" />
          New Chat
        </button>

        <hr className="border-gray-700 my-2" />

        <div className="text-white text-xs mb-1">Recent</div>
        {history.map((item) => (
          <div key={item} className="flex items-center justify-between gap-1 px-2 text-white text-sm hover:bg-[#222] rounded">
            <button
              onClick={() => {
                navigate("/chatboard");
                if (isMobile) setIsOpen(false);
              }}
              className="text-left truncate py-1"
            >
              {item}
            </button>
            <Trash2
              size={14}
              className="text-gray-400 hover:text-red-500 cursor-pointer"
              onClick={() => deleteHistory(item)}
            />
          </div>
        ))}

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
