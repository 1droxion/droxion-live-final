import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  FiGrid,
  FiPlusSquare,
  FiFolder,
  FiMessageSquare,
  FiImage,
  FiSettings,
  FiLogOut,
  FiX,
} from "react-icons/fi";
import { supabase } from "../supabaseClient";

const navigation = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: FiGrid,
  },
  {
    label: "New Campaign",
    path: "/new-campaign",
    icon: FiPlusSquare,
  },
  {
    label: "My Campaigns",
    path: "/projects",
    icon: FiFolder,
  },
  {
    label: "AI Chat",
    path: "/chatboard",
    icon: FiMessageSquare,
  },
  {
    label: "AI Images",
    path: "/ai-image",
    icon: FiImage,
  },
];

export default function Sidebar({ open, onClose }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Logout failed:", error);
      return;
    }

    navigate("/", { replace: true });
  };

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
        />
      )}

      <aside
        className={`
          fixed left-0 top-0 z-50 flex h-screen w-72 flex-col
          border-r border-white/10 bg-[#0b0d12]
          transition-transform duration-300
          lg:translate-x-0
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-6">
          <div>
            <h1 className="text-xl font-bold text-white">
              Droxion
            </h1>

            <p className="text-xs text-gray-500">
              AI Marketing Studio
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-lg p-2 text-gray-400 transition hover:bg-white/5 hover:text-white lg:hidden"
          >
            <FiX size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6">
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-gray-600">
            Workspace
          </p>

          <div className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `
                      flex items-center gap-3 rounded-xl
                      px-4 py-3 text-sm font-medium transition
                      ${
                        isActive
                          ? "bg-blue-600 text-white"
                          : "text-gray-400 hover:bg-white/5 hover:text-white"
                      }
                    `
                  }
                >
                  <Icon size={19} />

                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>

          <p className="mb-3 mt-8 px-3 text-xs font-semibold uppercase tracking-wider text-gray-600">
            Account
          </p>

          <NavLink
            to="/settings"
            onClick={onClose}
            className={({ isActive }) =>
              `
                flex items-center gap-3 rounded-xl
                px-4 py-3 text-sm font-medium transition
                ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }
              `
            }
          >
            <FiSettings size={19} />

            <span>Settings</span>
          </NavLink>
        </nav>

        <div className="border-t border-white/10 p-4">
          <button
            type="button"
            onClick={handleLogout}
            className="
              flex w-full items-center gap-3 rounded-xl
              px-4 py-3 text-sm font-medium text-gray-400
              transition hover:bg-red-500/10 hover:text-red-400
            "
          >
            <FiLogOut size={19} />

            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
