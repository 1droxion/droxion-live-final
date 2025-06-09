import React, { useState, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

import AIChat from "./AIChat";
import AIImage from "./AIImage";
import Plans from "./Plans";
import Projects from "./Projects";
import Templates from "./Templates";
import Connect from "./Connect";
import Editor from "./Editor";
import Settings from "./Settings";
import LandingPage from "./LandingPage";
import Login from "./Login";
import Signup from "./Signup";
import Analytics from "./Analytics";
import LiveEarth from "./LiveEarth"; // ✅ NEW: Live Earth Page

export default function App() {
  const location = useLocation();
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, [location]);

  // ✅ Track time spent on session
  useEffect(() => {
    const startTime = Date.now();
    const handleUnload = () => {
      const duration = Math.floor((Date.now() - startTime) / 1000);
      fetch(
        `${
          import.meta.env.VITE_BACKEND_URL || "https://droxion-backend.onrender.com"
        }/track`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "session_time",
            path: window.location.pathname,
            duration,
            userAgent: navigator.userAgent,
          }),
        }
      );
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => {
      handleUnload();
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, []);

  return (
    <div className="flex min-h-screen bg-[#0e0e10] text-white">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col">
        <Topbar toggleSidebar={() => setSidebarOpen(!isSidebarOpen)} />
        <div className="p-4">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/chatboard" element={<AIChat />} />
            <Route path="/ai-image" element={<AIImage />} />
            <Route path="/plans" element={<Plans />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/connect" element={<Connect />} />
            <Route path="/editor" element={<Editor />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/live-earth" element={<LiveEarth />} /> {/* ✅ NEW */}
          </Routes>
        </div>
      </div>
    </div>
  );
}
