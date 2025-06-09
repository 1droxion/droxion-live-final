import React, { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";

function Topbar({ toggleSidebar }) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-[#111827] border-b border-gray-800">
      {/* Left: Hamburger + Logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="text-white block lg:hidden"
          title="Toggle menu"
        >
          <Menu size={22} />
        </button>

        <h1
          className="text-white font-semibold text-lg cursor-pointer hidden sm:block"
          onClick={() => navigate("/")}
        >
          Droxion
        </h1>
      </div>

      {/* Center: Search */}
      <div className="flex-1 mx-4 max-w-lg hidden md:block">
        <input
          type="text"
          placeholder="🔍 Search videos, tools, templates..."
          className="w-full px-4 py-2 rounded-md bg-[#1f2937] text-white placeholder-gray-400 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Right: (Avatar removed) */}
      <div className="flex items-center gap-3">
        {/* No avatar here */}
      </div>
    </div>
  );
}

export default Topbar;
