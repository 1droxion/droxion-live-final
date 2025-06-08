import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Compass, Zap, MessageSquare, Image, Layers, Folder, LayoutTemplate,
  Link as ConnectIcon, Edit, User, Settings
} from "lucide-react";

function Sidebar({ isOpen, setIsOpen }) {
  const location = useLocation();

  const routes = [
    { path: "/dashboard", icon: Compass, label: "Dashboard" },
    { path: "/generator", icon: Zap, label: "Generator" },
    { path: "/auto-generator", icon: Zap, label: "Auto Generator" },
    { path: "/chatboard", icon: MessageSquare, label: "AI Chat" },
    { path: "/ai-image", icon: Image, label: "AI Image" },
    { path: "/plans", icon: Layers, label: "Plans" },
    { path: "/projects", icon: Folder, label: "Projects" },
    { path: "/templates", icon: LayoutTemplate, label: "Templates" },
    { path: "/connect", icon: ConnectIcon, label: "Connect" },
    { path: "/editor", icon: Edit, label: "Editor" },
    { path: "/profile", icon: User, label: "Profile" },
    { path: "/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <div className={`bg-[#111827] ${isOpen ? "w-64" : "w-20"} transition-all duration-300 h-screen p-4`}>
      <button
        className="mb-4 text-white"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? "← Close" : "→ Open"}
      </button>

      <nav>
        {routes.map(({ path, icon: Icon, label }) => (
          <Link
            key={path}
            to={path}
            className={`flex items-center my-3 p-2 rounded-md transition ${
              location.pathname === path
                ? "bg-green-500 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Icon className="w-6 h-6" />
            {isOpen && <span className="ml-4">{label}</span>}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export default Sidebar;
