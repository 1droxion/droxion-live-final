import React, { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";

function Topbar({ toggleSidebar }) {
  const navigate = useNavigate();
  const credits = localStorage.getItem("droxion_credits") || 0;
  const [avatar, setAvatar] = useState("/avatar.png");

  useEffect(() => {
    const storedAvatar = localStorage.getItem("droxion_avatar");
    if (storedAvatar) setAvatar(storedAvatar);
  }, []);

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-[#111827] border-b border-gray-800">
      {/* Left: Logo + 3-dots */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="lg:hidden text-white hover:text-gray-400"
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
      <div className="flex-1 mx-4 max-w-lg">
        <input
          type="text"
          placeholder="🔍 Search videos, tools, templates..."
          className="w-full px-4 py-2 rounded-md bg-[#1f2937] text-white placeholder-gray-400 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Right: Credits + Language + Avatar */}
      <div className="flex items-center gap-4">
        <div className="bg-black px-2 py-1 rounded text-green-400 font-semibold text-sm border border-green-600">
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
          className="w-8 h-8 rounded-full object-cover border border-gray-600"
        />
      </div>
    </div>
  );
}

export default Topbar;
