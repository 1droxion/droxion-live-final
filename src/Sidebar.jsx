import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Image,
  GalleryHorizontal,
  Film,
  PencilRuler,
  Link2,
  User,
  Settings,
  Code,
} from "lucide-react"; // ✅ Added Code icon

function Sidebar({ isOpen, setIsOpen }) {
  const location = useLocation();

  const navLinks = [
    { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { label: "AI Image", path: "/ai-image", icon: Image },
    { label: "Code Assistant", path: "/code", icon: Code }, // ✅ New Route
    { label: "Plans", path: "/plans", icon: GalleryHorizontal },
    { label: "Projects", path: "/projects", icon: Film },
    { label: "Templates", path: "/templates", icon: PencilRuler },
    { label: "Connect", path: "/connect", icon: Link2 },
    { label: "Editor", path: "/editor", icon: PencilRuler },
    { label: "Profile", path: "/profile", icon: User },
    { label: "Settings", path: "/settings", icon: Settings },
  ];

  const handleNavClick = () => {
    if (window.innerWidth < 1024 && setIsOpen) {
      setIsOpen(false); // Auto-close on mobile
    }
  };

  return (
    <div
      className={`${
        isOpen ? "w-56" : "w-16"
      } h-screen bg-[#0e0e10] border-r border-gray-800 text-white transition-all duration-300 flex flex-col px-2 py-4`}
    >
      <div className="flex items-center justify-center mb-6 text-xl font-bold tracking-wide">
        {isOpen ? "🚀 Droxion" : "🚀"}
      </div>

      <nav className="flex flex-col gap-1">
        {navLinks.map(({ label, path, icon: Icon }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={label}
              to={path}
              onClick={handleNavClick}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                active
                  ? "bg-[#1f2937] text-green-400 font-semibold shadow-sm shadow-green-400/10"
                  : "text-gray-400 hover:text-white hover:bg-[#1a1a1a]"
              }`}
            >
              <Icon size={20} />
              {isOpen && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default Sidebar;
