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

function Sidebar({ isOpen }) {
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

  return (
    <div className="h-full bg-[#111] border-r border-gray-800 p-4 flex flex-col">
      <h1 className="text-xl font-bold mb-6 text-white">{isOpen ? "Droxion" : "🚀"}</h1>
      <div className="flex flex-col gap-2">
        {navLinks.map(({ label, path, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className={`flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[#1f2937] transition ${
              location.pathname === path ? "bg-[#1f2937] text-green-400 font-semibold" : "text-gray-300"
            }`}
          >
            <Icon size={20} />
            {isOpen && <span>{label}</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default Sidebar;
