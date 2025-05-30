import React from "react";
import { Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";

function Topbar({ toggleSidebar }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("droxion_user")) || {};
  const avatar = localStorage.getItem("droxion_avatar");

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-[#111827] border-b border-gray-800">
      {/* Left: Toggle + Logo */}
      <div className="flex items-center gap-4">
        <button onClick={toggleSidebar} className="text-white lg:hidden">
          <Menu size={28} />
        </button>
        <span
          className="text-white font-bold text-lg cursor-pointer hidden sm:block"
          onClick={() => navigate("/")}
        >
          Droxion
        </span>
      </div>

      {/* Center: Search */}
      <div className="flex-1 mx-4 max-w-lg">
        <input
          type="text"
          placeholder="🔍 Search videos, tools, templates..."
          className="w-full px-4 py-2 rounded-md bg-[#1f2937] text-white placeholder-gray-400 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Right: Info */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-semibold text-green-400">
          ${user.credits || 0}
        </span>
        <select className="bg-[#1f2937] text-white px-2 py-1 rounded-md border border-gray-700 text-sm">
          <option>English</option>
          <option>Hindi</option>
        </select>
        <img
          src={
            avatar ||
            `https://ui-avatars.com/api/?name=${user.username || "User"}&background=0D8ABC&color=fff`
          }
          alt="avatar"
          className="w-9 h-9 rounded-full object-cover border-2 border-green-500"
        />
      </div>
    </div>
  );
}

export default Topbar;
