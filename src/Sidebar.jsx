import React, { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home,
  LayoutDashboard,
  Clapperboard,
  Sparkles,
  MessageSquare,
  ImageIcon,
  FolderKanban,
  BookOpenText,
  Rocket,
  PencilLine,
  User,
  Settings,
  X,
} from "lucide-react";
import { useSidebar } from "./context/SidebarContext";
import logo from "./assets/droxion-logo.png";
import ThemeToggle from "./ThemeToggle";

function Sidebar() {
  const { isSidebarOpen, toggleSidebar } = useSidebar();
  const location = useLocation();

  // ESC key to close sidebar
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") toggleSidebar();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [toggleSidebar]);

  // Sidebar fully hidden on small screens unless open
  return (
    <div
      className={`fixed top-0 right-0 h-full w-64 bg-[var(--bg)] text-[var(--text)] z-50 border-l border-gray-800 shadow-xl overflow-y-auto transform transition-transform duration-300 ease-in-out ${
        isSidebarOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      {/* Header / Logo */}
      <div className="flex justify-between items-center px-4 py-4 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Droxion Logo" className="h-10 w-10 rounded-full object-cover" />
          <span className="font-bold text-lg text-green-400">Droxion</span>
        </div>
        <button onClick={toggleSidebar} className="text-gray-400 hover:text-red-400 transition">
          <X size={22} />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex flex-col px-4 py-3 gap-1 text-sm">
        {sidebarItems.map((item) => (
          <SidebarLink
            key={item.label}
            to={item.to}
            icon={item.icon}
            label={item.label}
            toggle={toggleSidebar}
            active={location.pathname === item.to}
          />
        ))}
      </nav>

      {/* Theme Toggle at Bottom */}
      <div className="flex justify-center mt-6 mb-4">
        <ThemeToggle />
      </div>
    </div>
  );
}

// Reusable Sidebar Link
function SidebarLink({ to, icon, label, toggle, active }) {
  return (
    <Link
      to={to}
      onClick={toggle}
      className={`flex items-center gap-3 px-4 py-2 rounded-lg transition text-[var(--text)]
        ${active ? "bg-green-600 text-white" : "hover:bg-gray-700"}`}
    >
      {icon}
      <span className="md:inline hidden">{label}</span>
    </Link>
  );
}

const sidebarItems = [
  { to: "/landing", icon: <Home className="w-5 h-5" />, label: "Landing" },
  { to: "/dashboard", icon: <LayoutDashboard className="w-5 h-5" />, label: "Dashboard" },
  { to: "/generator", icon: <Clapperboard className="w-5 h-5" />, label: "Generator" },
  { to: "/autogenerator", icon: <Sparkles className="w-5 h-5" />, label: "Auto Generator" },
  { to: "/aichat", icon: <MessageSquare className="w-5 h-5" />, label: "AI Chat" },
  { to: "/aiimage", icon: <ImageIcon className="w-5 h-5" />, label: "AI Image" },
  { to: "/plans", icon: <FolderKanban className="w-5 h-5" />, label: "Plans" },
  { to: "/projects", icon: <BookOpenText className="w-5 h-5" />, label: "Projects" },
  { to: "/templates", icon: <BookOpenText className="w-5 h-5" />, label: "Templates" },
  { to: "/connect", icon: <Rocket className="w-5 h-5" />, label: "Connect" },
  { to: "/editor", icon: <PencilLine className="w-5 h-5" />, label: "Editor" },
  { to: "/profile", icon: <User className="w-5 h-5" />, label: "Profile" },
  { to: "/settings", icon: <Settings className="w-5 h-5" />, label: "Settings" },
];

export default Sidebar;
