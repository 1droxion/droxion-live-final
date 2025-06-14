import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Zap,
  MessageSquare,
  Globe,
  Layers,
  LogIn,
  UserPlus,
  Moon,
  Sun
} from "lucide-react";

function Sidebar({ isOpen, setIsOpen }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = window.innerWidth < 768;

  const [isDark, setIsDark] = React.useState(
    localStorage.getItem("theme") === "dark"
  );

  const handleNavClick = (path) => {
    navigate(path);
    if (isMobile) setIsOpen(false);
  };

  const toggleTheme = () => {
    const newTheme = isDark ? "light" : "dark";
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("light", newTheme === "light");
    setIsDark(!isDark);
  };

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light") document.documentElement.classList.add("light");
  }, []);

  const routes = [
    { path: "/", icon: Zap, label: "Smart Bar" },
    { path: "/generator", icon: Globe, label: "Generator" },
    { path: "/chatboard", icon: MessageSquare, label: "AI Chat" },
    { path: "/plans", icon: Layers, label: "Plans" },
    { path: "/login", icon: LogIn, label: "Login" },
    { path: "/signup", icon: UserPlus, label: "Signup" }
  ];

  return (
    <aside
      className={`${
        isOpen ? "w-64" : "w-16"
      } bg-[#111] transition-all duration-300 overflow-hidden shadow-xl border-r border-gray-800 fixed md:static z-50 h-full`}
    >
      <div className="h-full flex flex-col justify-between p-4">
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-green-400 mb-4">
            {isOpen ? "🚀 Droxion" : "🚀"}
          </h2>

          {routes.map((route) => {
            const isActive = location.pathname === route.path;
            const Icon = route.icon;

            return (
              <button
                key={route.path}
                onClick={() => handleNavClick(route.path)}
                className={`flex items-center ${
                  isOpen ? "gap-3" : "justify-center"
                } px-4 py-3 rounded-lg transition-all hover:bg-[#222] ${
                  isActive ? "bg-green-700 text-white" : "text-gray-300"
                }`}
              >
                <Icon size={18} />
                {isOpen && <span className="text-sm">{route.label}</span>}
              </button>
            );
          })}
        </div>

        <div className="pt-6 border-t border-gray-700">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-[#222] rounded-lg w-full"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
            {isOpen && <span>{isDark ? "Light Mode" : "Dark Mode"}</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
