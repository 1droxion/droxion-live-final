import React, { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

function Topbar({ toggleSidebar }) {
  const navigate = useNavigate();
  const [credits, setCredits] = useState(localStorage.getItem("droxion_credits") || 0);
  const [avatar, setAvatar] = useState("/avatar.png");

  // ✅ Update avatar anytime it's changed in localStorage
  useEffect(() => {
    const updateAvatar = () => {
      const storedAvatar = localStorage.getItem("droxion_avatar");
      if (storedAvatar) setAvatar(storedAvatar);
    };

    updateAvatar(); // on first load
    window.addEventListener("storage", updateAvatar); // on change from profile

    return () => {
      window.removeEventListener("storage", updateAvatar);
    };
  }, []);

  // ✅ Load credits from API
  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_BACKEND_URL || "https://droxion-backend.onrender.com"}/user-stats`)
      .then((res) => {
        if (res.data.credits !== undefined) {
          setCredits(res.data.credits);
          localStorage.setItem("droxion_credits", res.data.credits);
        }
      })
      .catch((err) => {
        console.warn("⚠️ Failed to fetch credits from backend.", err);
      });
  }, []);

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-[#111827] border-b border-gray-800">
      {/* Left: Logo + Menu */}
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
        <div
          className="bg-black px-2 py-1 rounded text-green-400 font-semibold text-sm border border-green-600 cursor-pointer"
          onClick={() => navigate("/plans")}
          title="Click to view/upgrade plan"
        >
          💰 {credits}
        </div>

        <select className="bg-[#1f2937] text-white text-sm px-2 py-1 rounded-md border border-gray-700 focus:outline-none">
          <option>English</option>
          <option>Hindi</option>
          <option>Gujarati</option>
        </select>

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
