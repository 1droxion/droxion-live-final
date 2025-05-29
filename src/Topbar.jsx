import React from "react";
import { Menu } from "lucide-react";

function Topbar({ toggleSidebar }) {
  const credits = localStorage.getItem("droxion_credits") || 0;

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-[#111827] border-b border-gray-800">
      {/* Left: Sidebar Toggle + Logo */}
      <div className="flex items-center gap-3">
        {/* Sidebar Toggle (visible on mobile) */}
        <button onClick={toggleSidebar} className="lg:hidden text-white hover:text-gray-400">
          <Menu size={22} />
        </button>

        {/* Logo Text */}
        <h1 className="text-white font-semibold text-lg hidden sm:block">Droxion</h1>
      </div>

      {/* Center: Search */}
      <div className="flex-1 mx-4 max-w-lg">
        <input
          type="text"
          placeholder="Search..."
          className="w-full px-4 py-2 rounded-md bg-[#1f2937] text-white placeholder-gray-400 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Right: Credits, Language, Avatar */}
      <div className="flex items-center gap-4">
        {/* Credits */}
        <div className="text-green-400 font-medium text-sm">${credits}</div>

        {/* Language Dropdown */}
        <select
          className="bg-[#1f2937] text-white text-sm px-2 py-1 rounded-md border border-gray-700 focus:outline-none"
        >
          <option>English</option>
          <option>Hindi</option>
          <option>Gujarati</option>
        </select>

        {/* User Avatar */}
        <img
          src="/avatar.png"
          alt="User Avatar"
          className="w-8 h-8 rounded-full object-cover border border-gray-600"
        />
      </div>
    </div>
  );
}

export default Topbar;
