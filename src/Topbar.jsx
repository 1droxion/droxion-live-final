import React, { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";

function Topbar({ toggleSidebar }) {
  const navigate = useNavigate();
  const [avatar, setAvatar] = useState("/avatar.png");
  const [credits, setCredits] = useState(0);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("droxion_user"));
    const avatarUrl = localStorage.getItem("droxion_avatar");

    if (user) {
      setCredits(user.credits || 0);
    }
    if (avatarUrl) {
      setAvatar(avatarUrl);
    }
  }, []);

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-[#111827] border-b border-gray-800 shadow">
      {/* Left: Logo + 3-dots toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="text-white hover:text-gray-400 lg:hidden"
        >
          <Menu size={22} />
        </button>
        <h1
          className="text-white font-semibold text-lg hidden sm:block cursor-pointer"
          onClick={() => navigate("/")}
        >
          Droxion
        </h1>
      </div>

      {/* Center: Search bar */}
      <div className="flex-1 mx-4 max-w-xl relative">
        <input
          type="text"
          placeholder="🔍 Search videos, tools, templates..."
          className="w-full px-4 py-2 rounded-md bg-[#1f2937] text-white placeholder-gray-400 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Right: Credits, Language, Avatar */}
      <div className="flex items-center gap-4">
        <div className="bg-black px-3 py-1 rounded-full border border-green-500 text-green-400 font-semibold text-sm shadow">
          ${credits}
        </div>

        <select className="bg-[#1f2937] text-white text-sm px-2 py-1 rounded-md border border-gray-700 focus:outline-none">
          <option>English</option>
          <option>Hindi</option>
          <option>Gujarati</option>
        </select>

        <img
          src={avatar}
          alt="User"
          className="w-9 h-9 rounded-full object-cover border border-gray-600 hover:scale-105 transition"
        />
      </div>
    </div>
  );
}

export default Topbar;
