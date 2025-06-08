import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Compass, Zap, MessageSquare, Image, Layers, Folder, LayoutTemplate,
  Link as ConnectIcon, Edit, User, Settings, LogOut, LogIn, UserPlus
} from "lucide-react";

function Sidebar({ isOpen, setIsOpen }) {
  const location = useLocation();
  const navigate = useNavigate();

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

  const handleNavClick = (path) => {
    navigate(path);
    setIsOpen(false); // Automatically close sidebar
  };

  return (
    <div className={`bg-[#111827] ${isOpen ? "w-56" : "w-14"} transition-all duration-300 h-screen flex flex-col`}>
      
      <button
        className="text-gray-400 hover:text-white p-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? "←" : "→"}
      </button>

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
            // Implement logout logic here
            navigate("/login");
            setIsOpen(false);
          }}
          className="flex items-center p-2 rounded transition text-red-400 hover:bg-red-700 hover:text-white w-full"
        >
          <LogOut className="w-5 h-5" />
          {isOpen && <span className="ml-3 text-sm">Logout</span>}
        </button>
      </div>

    </div>
  );
}

export default Sidebar;
