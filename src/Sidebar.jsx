import React from "react";
import { FaMoon, FaSun, FaVolumeUp, FaVolumeMute, FaPlus } from "react-icons/fa";

function Sidebar({ isOpen, setIsOpen, onNewChat, voiceMode, setVoiceMode, darkMode, setDarkMode }) {
  const history = JSON.parse(localStorage.getItem("chat_history") || "[]");

  return (
    <aside
      className={`${isOpen ? "w-64" : "w-0"} bg-[#111] transition-all duration-300 overflow-hidden shadow-xl border-r border-gray-800 fixed md:static z-50 h-full`}
    >
      <div className="h-full flex flex-col p-4 space-y-4">
        <h2 className="text-xl font-bold text-green-400 mb-2">🚀 Droxion</h2>
        <button
          onClick={onNewChat}
          className="flex items-center gap-2 text-sm py-2 px-3 bg-green-700 rounded text-white hover:bg-green-600"
        >
          <FaPlus size={12} /> New Chat
        </button>

        <div className="flex items-center justify-between text-sm text-gray-300">
          <span>Voice</span>
          <button onClick={() => setVoiceMode(!voiceMode)}>
            {voiceMode ? <FaVolumeUp /> : <FaVolumeMute />}
          </button>
        </div>
        <div className="flex items-center justify-between text-sm text-gray-300">
          <span>Dark Mode</span>
          <button onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? <FaMoon /> : <FaSun />}
          </button>
        </div>

        {history.length > 0 && (
          <div className="mt-4">
            <div className="text-xs text-gray-400 mb-1">Recent</div>
            <ul className="space-y-1">
              {history.map((h, i) => (
                <li key={i} className="text-gray-300 text-sm truncate">
                  {h}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
