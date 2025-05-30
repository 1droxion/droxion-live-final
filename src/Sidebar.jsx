import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Sparkles,
  Wand2,
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
    { label: "AI Chat", path: "/chatboard", icon: Bot },
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
    if (window.innerWidth < 768 && toggleSidebar) {
      toggleSidebar(); // auto close on small screens
    }
  };

  return (
    <div
      className={`h-full border-r border-gray-800 p-3 flex flex-col transition-all duration-300 bg-[#0e0e10] ${
        isOpen ? "w-64" : "w-16"
      }`}
    >
      <h1 className="text-2xl font-bold text-white mb-6 text-center">{isOpen ? "🚀 Droxion" : "🚀"}</h1>
      <nav className="flex flex-col gap-3">
        {navLinks.map(({ label, path, icon: Icon }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={label}
              to={path}
              onClick={handleNavClick}
              className={`flex items-center gap-4 px-3 py-2 rounded-lg text-sm transition-all
                ${
                  active
                    ? "bg-[#1f2937] text-green-400 shadow-inner"
                    : "text-gray-300 hover:bg-[#1f2937] hover:text-white"
                }
              `}
            >
              <Icon size={24} />
              {isOpen && <span className="text-base font-medium">{label}</span>}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default Sidebar;
