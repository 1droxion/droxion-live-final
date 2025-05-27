import React, { useEffect, useState } from "react";
import { useSidebar } from "./context/SidebarContext";
import { Search, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";

function Topbar() {
  const { toggleSidebar } = useSidebar();
  const navigate = useNavigate();

  const [credits, setCredits] = useState(0);
  const [username, setUsername] = useState("User");
  const [avatar, setAvatar] = useState("");

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("droxion_user"));
    const storedAvatar = localStorage.getItem("droxion_avatar");

    if (user) {
      setCredits(user.credits || 0);
      setUsername(user.username || "User");
    }
    setAvatar(
      storedAvatar ||
        `https://ui-avatars.com/api/?name=${user?.username || "User"}&background=0D8ABC&color=fff`
    );
  }, []);

  // Auto-refresh credits every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const user = JSON.parse(localStorage.getItem("droxion_user"));
      if (user) {
        setCredits(user.credits || 0);
        setUsername(user.username || "User");
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleSearch = (e) => {
    if (e.key === "Enter") {
      const q = e.target.value.toLowerCase();
      if (q.includes("generator") || q.includes("reel")) navigate("/generator");
      else if (q.includes("chat")) navigate("/aichat");
      else if (q.includes("image") || q.includes("ai")) navigate("/aiimage");
      else if (q.includes("project")) navigate("/projects");
      else if (q.includes("credit") || q.includes("plan")) navigate("/plans");
      else if (q.includes("profile")) navigate("/profile");
      else alert("No page found for: " + q);
    }
  };

  return (
    <header className="w-full sticky top-0 z-40 bg-[var(--bg)] bg-opacity-90 backdrop-blur-md border-b border-gray-700 shadow-sm">
      <div className="flex justify-between items-center px-4 py-3">
        {/* Left: Logo */}
        <div className="text-xl font-bold text-green-400">Droxion</div>

        {/* Center: Search */}
        <div className="flex-1 mx-6 hidden md:flex justify-center">
          <div className="relative w-full max-w-md">
            <input
              type="text"
              placeholder="Search pages..."
              onKeyDown={handleSearch}
              className="w-full px-4 py-2 pl-10 rounded-md bg-[#2d3748] text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
        </div>

        {/* Right: Credits, Avatar, Toggle */}
        <div className="flex items-center gap-4">
          {/* Credits */}
          <div className="flex items-center gap-1 text-white text-sm bg-gray-800 px-2 py-1 rounded-md">
            <DollarSign className="w-4 h-4" />
            <span>{credits}</span>
          </div>

          {/* Avatar */}
          <img
            src={avatar}
            alt="Avatar"
            onClick={() => navigate("/profile")}
            className="w-8 h-8 rounded-full cursor-pointer hover:ring-2 hover:ring-green-400 transition"
          />

          {/* Sidebar Toggle */}
          <button
            onClick={toggleSidebar}
            className="text-white text-2xl hover:text-gray-300 transition"
            aria-label="Toggle Sidebar"
          >
            &#8942;
          </button>
        </div>
      </div>
    </header>
  );
}

export default Topbar;
