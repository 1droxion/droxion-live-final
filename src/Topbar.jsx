import React, { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";

function Topbar({ toggleSidebar }) {
  const navigate = useNavigate();
  const [avatar, setAvatar] = useState(localStorage.getItem("droxion_avatar") || "/avatar.png");

  // ✅ Live sync avatar from localStorage
  useEffect(() => {
    const syncAvatar = () => {
      const storedAvatar = localStorage.getItem("droxion_avatar");
      if (storedAvatar && storedAvatar !== avatar) {
        setAvatar(storedAvatar);
      }
    };

    syncAvatar();
    window.addEventListener("storage", syncAvatar);
    const interval = setInterval(syncAvatar, 5000);

    return () => {
      window.removeEventListener("storage", syncAvatar);
      clearInterval(interval);
    };
  }, [avatar]);

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-[#111827] border-b border-gray-800">
      {/* Left: Hamburger + Logo */}
      <div className="flex items-center gap-3">
        <button onClick={toggleSidebar} className="lg:hidden text-white hover:text-gray-400">
          <Menu size={22} />
        </button>
        <h1
          className="text-white font-semibold text-lg cursor-pointer hidden sm:block"
          onClick={() => navigate("/")}
        >
          Droxion
        </h1>
      </div>

      {/* Center: Search bar */}
      <div className="flex-1 mx-4 max-w-lg">
        <input
          type="text"
          placeholder="🔍 Search videos, tools, templates..."
          className="w-full px-4 py-2 rounded-md bg-[#1f2937] text-white placeholder-gray-400 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Right: Avatar only */}
      <div className="flex items-center gap-3">
        <img
          src={avatar}
          alt="User"
          onClick={() => navigate("/profile")}
          className="w-8 h-8 rounded-full object-cover border border-gray-600 cursor-pointer"
          title="Profile"
        />
      </div>
    </div>
  );
}

export default Topbar;
