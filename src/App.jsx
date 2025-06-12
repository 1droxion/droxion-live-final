import React, { useState, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import Generator from "./Generator"; // ✅ Your reel page
import AIChat from "./AIChat";
import AIImage from "./AIImage";
import Plans from "./Plans";
import Login from "./Login";
import Signup from "./Signup";
import Settings from "./Settings";

export default function App() {
  const location = useLocation();
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, [location]);

  return (
    <div className="flex min-h-screen bg-[#0e0e10] text-white">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col">
        <Topbar toggleSidebar={() => setSidebarOpen(!isSidebarOpen)} />
        <div className="p-4">
          <Routes>
            <Route path="/" element={<Generator />} /> {/* ✅ Set as homepage */}
            <Route path="/generator" element={<Generator />} />
            <Route path="/chatboard" element={<AIChat />} />
            <Route path="/ai-image" element={<AIImage />} />
            <Route path="/plans" element={<Plans />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
