import React from "react";
import { Menu } from "lucide-react";
import SearchBar from "./SearchBar";

function Topbar({ toggleSidebar }) {
  const credits = localStorage.getItem("droxion_credits") || 0;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a1a] text-white border-b border-gray-700">
      {/* Logo + Sidebar Toggle */}
      <div className="flex items-center gap-3">
        <button onClick={toggleSidebar}>
          <Menu className="w-6 h-6" />
        </button>
        <img src="/logo1.png" alt="Droxion Logo" className="w-9 h-9 rounded-full object-cover" />
      </div>

      {/* Center: Search */}
      <div className="w-full max-w-md px-4">
        <SearchBar />
      </div>

      {/* Credits + Language + Avatar */}
      <div className="flex items-center gap-4">
        <div className="text-green-400 font-semibold">${credits}</div>
        <select className="bg-transparent text-white border border-gray-600 px-2 py-1 rounded">
          <option>English</option>
          <option>Hindi</option>
        </select>
        <img src="/avatar.png" alt="User Avatar" className="w-8 h-8 rounded-full object-cover" />
      </div>
    </div>
  );
}

export default Topbar;
