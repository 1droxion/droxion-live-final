import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { FiMenu, FiBell } from "react-icons/fi";
import Sidebar from "./Sidebar";

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#08090c] text-white">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-white/10 bg-[#08090c]/90 px-4 backdrop-blur sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-xl border border-white/10 p-3 text-gray-300 hover:bg-white/5 lg:hidden"
          >
            <FiMenu size={20} />
          </button>

          <div className="hidden lg:block">
            <p className="text-sm text-gray-500">Droxion Workspace</p>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              className="rounded-xl border border-white/10 p-3 text-gray-400 transition hover:bg-white/5 hover:text-white"
            >
              <FiBell size={19} />
            </button>

            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 font-bold">
              D
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
