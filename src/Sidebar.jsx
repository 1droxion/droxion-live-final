import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Wand2,
  Sparkles,
  Image,
  Film,
  Bot,
  GalleryHorizontal,
  Link2,
  PencilRuler,
  User,
  Settings,
} from "lucide-react";

function Sidebar() {
  const location = useLocation();

  const navLinks = [
    { label: "Landing", path: "/", icon: LayoutDashboard },
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
    <div className="w-[250px] bg-[#111] text-white p-4 h-screen overflow-y-auto border-l border-gray-800 sticky top-0">
      <div className="text-center text-xl font-bold mb-6 tracking-wider text-white">
        DROXION
      </div>
      <div className="flex flex-col gap-3">
        {navLinks.map(({ label, path, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className={`flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-[#1f2937] transition ${
              location.pathname === path ? "bg-[#1f2937] font-semibold" : "text-gray-300"
            }`}
          >
            <Icon className="w-5 h-5" />
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default Sidebar;
