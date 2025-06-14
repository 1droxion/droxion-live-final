import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  MessageSquare,
  Globe,
  Layers,
  LogIn,
  UserPlus
} from "lucide-react";

function Sidebar({ isOpen, setIsOpen }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = window.innerWidth < 768;

  const handleNavClick = (path) => {
    navigate(path);
    if (isMobile) setIsOpen(false);
  };

  const routes = [
    { path: "/generator", icon: Globe, label: "Generator" },
    { path: "/chatboard", icon: MessageSquare, label: "AI Chat" },
    { path: "/plans", icon: Layers, label: "Plans" },
    { path: "/login", icon: LogIn, label: "Login" },
    { path: "/signup", icon: UserPlus, label: "Signup" }
  ];

  return (
    <aside
      className={`${
        isOpen ? "w-64" : "w-0"
      } bg-[#111] transition-all duration-300 overflow-hidden shadow-xl border-r border-gray-800 fixed md:static z-50 h-full`}
    >
      <div className="h-full flex flex-col p-4 space-y-2">
        <h2 className="text-xl font-bold text-green-400 mb-4">🚀 Droxion</h2>
        {routes.map((route) => {
          const isActive = location.pathname === route.path;
          const Icon = route.icon;

          return (
            <button
              key={route.path}
              onClick={() => handleNavClick(route.path)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all hover:bg-[#222] ${
                isActive ? "bg-green-700 text-white" : "text-gray-300"
              }`}
            >
              <Icon size={18} />
              <span className="text-sm">{route.label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

export default Sidebar;
