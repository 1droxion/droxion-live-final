import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Wand2,
  Sparkles,
  Bot,
  Image,
  GalleryHorizontal,
  Film,
  PencilRuler,
  Link2,
  User,
  Settings,
} from "lucide-react";

function Sidebar({ isOpen, toggleSidebar }) {
  const location = useLocation();

  const navLinks = [
    { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { label: "Generator", path: "/generator", icon: Sparkles },
    { label: "Auto Generator", path: "/auto-generator", icon: Wand2 },
    { label: "Chatboard", path: "/chatboard", icon: Bot },
    { label: "AI Image", path: "/ai-image", icon: Image },
    { label: "Plans", path: "/plans", icon: GalleryHorizontal },
    { label: "Projects", path: "/projects", icon: Film },
    { label: "Templates", path: "/templates", icon: PencilRuler },
    { label: "Connect", path: "/connect", icon: Link2 },
    { label: "Editor", path: "/editor", icon: PencilRuler },
    { label: "Profile", path: "/profile", icon: User },
    { label: "Settings", path: "/settings", icon: Settings },
  ];

  const handleNavClick = () => {
    if (window.innerWidth < 1024 && toggleSidebar) {
      toggleSidebar();
    }
  };

  return (
    <div className={`h-full border-r border-gray-800 p-4 flex flex-col bg-[#0f172a] transition-all duration-300 ${isOpen ? "w-56" : "w-16"}`}>
      <h1 className="text-xl font-bold mb-6 text-white text-center transition-opacity duration-300">
        {isOpen ? "Droxion" : "🚀"}
      </h1>
      <div className="flex flex-col gap-2">
        {navLinks.map(({ label, path, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            onClick={handleNavClick}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#1f2937] transition-all duration-150 ${
              location.pathname === path
                ? "bg-[#1f2937] text-green-400 font-semibold shadow-md shadow-green-500/30"
                : "text-gray-300"
            }`}
          >
            <Icon size={20} />
            {isOpen && <span className="whitespace-nowrap">{label}</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default Sidebar;
