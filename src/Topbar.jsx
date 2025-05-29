import React from "react";
import { Menu } from "lucide-react";

function Topbar({ toggleSidebar }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-[#1f2937] border-b border-gray-700">
      {/* Hamburger */}
      <button onClick={toggleSidebar} className="text-white hover:text-gray-400 lg:hidden">
        <Menu size={24} />
      </button>

      {/* Center content */}
      <div className="flex-1 flex justify-center">
        <input
          className="bg-gray-800 px-4 py-2 rounded-md text-sm w-full max-w-md outline-none focus:ring-2 focus:ring-green-500"
          placeholder="Search..."
        />
      </div>

      {/* Right side: credits / avatar */}
      <div className="flex gap-4 items-center">
        <span className="text-green-400 font-bold">$0</span>
        <select className="bg-gray-800 text-sm rounded px-2 py-1">
          <option>English</option>
        </select>
        <img src="/avatar.png" alt="User" className="w-8 h-8 rounded-full border border-gray-600" />
      </div>
    </div>
  );
}

export default Topbar;
