import React, { useEffect, useState } from "react";
import { Menu, Bell, Settings, LogOut } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

function Topbar({ toggleSidebar }) {
  const navigate = useNavigate();
  const location = useLocation();

  const credits = localStorage.getItem("droxion_credits") || 0;

  const [avatar, setAvatar] = useState(
    localStorage.getItem("droxion_avatar") ||
      `https://ui-avatars.com/api/?name=Droxion&background=0D8ABC&color=fff`
  );

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [language, setLanguage] = useState("English");

  useEffect(() => {
    const stored = localStorage.getItem("droxion_avatar");
    if (stored) setAvatar(stored);
  }, [location.pathname]);

  const handleLanguageChange = (e) => {
    const selected = e.target.value;
    setLanguage(selected);
    localStorage.setItem("droxion_language", selected);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const handleSettings = () => {
    navigate("/settings");
  };

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-[#111827] border-b border-gray-800 shadow-md backdrop-blur-md">
      <div className="flex items-center gap-3">
        <button onClick={toggleSidebar} className="lg:hidden text-white hover:text-gray-400">
          <Menu size={22} />
        </button>
        <h1
          className="text-white font-bold text-xl cursor-pointer bg-gradient-to-br from-green-400 to-lime-500 bg-clip-text text-transparent"
          onClick={() => navigate("/")}
        >
          Droxion
        </h1>
      </div>

      <div className="flex-1 mx-6 hidden md:block">
        <input
          type="text"
          placeholder="🔍 Search videos, tools, templates..."
          className="w-full px-4 py-2 rounded-xl bg-[#1f2937] text-white placeholder-gray-400 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
        />
      </div>

      <div className="flex items-center gap-4 relative">
        <div className="text-green-400 font-semibold text-sm bg-green-950 px-3 py-1 rounded-full shadow-sm">
          🎟 {credits}
        </div>

        <select
          value={language}
          onChange={handleLanguageChange}
          className="bg-[#1f2937] text-white text-sm px-2 py-1 rounded-md border border-gray-700 focus:outline-none"
        >
          <option>English</option>
          <option>Hindi</option>
          <option>Gujarati</option>
        </select>

        <button className="text-white hover:text-green-400">
          <Bell size={20} />
        </button>

        <div className="relative">
          <img
            src={avatar}
            onClick={() => setDropdownOpen(!dropdownOpen)}
            alt="User Avatar"
            className="w-9 h-9 rounded-full border-2 border-green-500 shadow-md cursor-pointer hover:scale-105 transition"
          />

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-44 bg-[#1f2937] text-white rounded-lg shadow-lg border border-gray-700 py-2 z-50">
              <button
                onClick={handleSettings}
                className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-800 w-full text-left"
              >
                <Settings size={16} /> Settings
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-800 w-full text-left"
              >
                <LogOut size={16} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Topbar;
