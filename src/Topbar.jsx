import React from "react";
import { Menu } from "lucide-react";

function Topbar({ toggleSidebar }) {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-4 py-2 bg-[#111827] shadow-sm border-b border-gray-800">
      {/* Hamburger */}
      <button onClick={toggleSidebar} className="lg:hidden text-white hover:text-gray-400">
        <Menu size={22} />
      </button>

      {/* Search Bar Center */}
      <div className="flex-1 flex justify-center px-4">
        <input
          type="text"
          placeholder="Search..."
          className="w-full max-w-md px-4 py-2 text-sm rounded-md bg-[#1f2937] text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-green-500 transition"
        />
      </div>

      {/* Right Side: Credits + Language + Avatar */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-green-400 font-bold">$0</span>
        <select className="bg-[#1f2937] text-white rounded px-2 py-1 text-xs border border-gray-700">
          <option>English</option>
        </select>
        <img
          src="/avatar.png"
          alt="User"
          className="w-8 h-8 rounded-full border border-gray-700 object-cover"
        />
      </div>
    </header>
  );
}

export default Topbar;
