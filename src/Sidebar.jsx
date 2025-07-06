import React from "react";
import { FaMoon, FaSun, FaVolumeUp, FaVolumeMute, FaPlus } from "react-icons/fa";

function Sidebar({ isOpen, setIsOpen, onNewChat, voiceMode, setVoiceMode, darkMode, setDarkMode }) {
  const history = JSON.parse(localStorage.getItem("chat_history") || "[]");

  return (
    <aside
      className={`${isOpen ? "w-20" : "w-0"} bg-black transition-all duration-300 overflow-hidden shadow-xl border-r border-gray-800 fixed md:static z-50 h-full`}
    >
      <div className="h-full flex flex-col p-2 space-y-3 items-center text-white">
        <h2 className="text-xs font-bold text-white mt-2 text-center">🚀</h2>

        {/* New Chat Button */}
        <button
          onClick={() => {
            onNewChat();
            setIsOpen(false); // auto-close on mobile
          }}
          className="flex flex-col items-center gap-1 text-xs py-2 px-2 hover:bg-white hover:text-black rounded"
        >
          <FaPlus size={16} />
          <span className="text-[10px]">New</span>
        </button>

        {/* Voice Toggle */}
        <button
          onClick={() => setVoiceMode(!voiceMode)}
          className="flex flex-col items-center gap-1 text-xs py-2 px-2 hover:bg-white hover:text-black rounded"
        >
          {voiceMode ? <FaVolumeUp size={16} /> : <FaVolumeMute size={16} />}
          <span className="text-[10px]">Voice</span>
        </button>

        {/* Dark Mode Toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="flex flex-col items-center gap-1 text-xs py-2 px-2 hover:bg-white hover:text-black rounded"
        >
          {darkMode ? <FaMoon size={16} /> : <FaSun size={16} />}
          <span className="text-[10px]">Theme</span>
        </button>

        {/* Recent History (Optional) */}
        {history.length > 0 && (
          <div className="mt-4 w-full text-center">
            <div className="text-[10px] text-gray-400 mb-1">Recent</div>
            <ul className="space-y-1 text-[10px] text-gray-300">
              {history.slice(0, 3).map((h, i) => (
                <li key={i} className="truncate px-1">{h}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
