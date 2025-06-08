import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  MessageSquare, Image, Layers, Folder, LayoutTemplate,
  Link as ConnectIcon, Edit, User, Settings, LogOut, LogIn, UserPlus
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
    <div
      className={`bg-[#111827] fixed lg:relative z-50 top-0 left-0 h-full transition-all duration-300 ease-in-out ${
        isOpen ? "w-56" : "w-0 lg:w-14"
      } overflow-hidden`}
    >
      <div className="flex flex-col h-full">
        <div className="p-2 lg:hidden">
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-white"
          >
            ✕ Close
          </button>
        </div>

        <nav className="flex-1 overflow-auto px-2 py-4 space-y-1">
          {routes.map(({ path, icon: Icon, label }) => (
            <button
              key={path}
              onClick={() => handleNavClick(path)}
              className={`flex items-center p-2 rounded transition ${
                location.pathname === path
                  ? "bg-green-500 text-white"
                  : "text-gray-300 hover:bg-gray-700 hover:text-white"
              } w-full`}
            >
              <Icon className="w-5 h-5" />
              {isOpen && <span className="ml-3 text-sm">{label}</span>}
            </button>
          ))}
        </nav>

        <div className="border-t border-gray-700 p-2 space-y-2">
          <button
            onClick={() => handleNavClick("/login")}
            className="flex items-center p-2 rounded transition text-gray-300 hover:bg-gray-700 hover:text-white w-full"
          >
            <LogIn className="w-5 h-5" />
            {isOpen && <span className="ml-3 text-sm">Login</span>}
          </button>

          <button
            onClick={() => handleNavClick("/signup")}
            className="flex items-center p-2 rounded transition text-gray-300 hover:bg-gray-700 hover:text-white w-full"
          >
            <UserPlus className="w-5 h-5" />
            {isOpen && <span className="ml-3 text-sm">Signup</span>}
          </button>

          <button
            onClick={() => {
              navigate("/login");
              if (isMobile) setIsOpen(false);
            }}
            className="flex items-center p-2 rounded transition text-red-400 hover:bg-red-700 hover:text-white w-full"
          >
            <LogOut className="w-5 h-5" />
            {isOpen && <span className="ml-3 text-sm">Logout</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
