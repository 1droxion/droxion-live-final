import React, { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

import Dashboard from "./Dashboard";
import Generator from "./Generator";
import AutoGenerator from "./AutoGenerator";
import Chatboard from "./Chatboard";
import AIImage from "./AIImage";
import Plans from "./Plans";
import Projects from "./Projects";
import Templates from "./Templates";
import Connect from "./Connect";
import Editor from "./Editor";
import Profile from "./Profile";
import Settings from "./Settings";

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    const closeSidebar = () => setSidebarOpen(false);

    window.addEventListener("resize", handleResize);
    document.body.addEventListener("toggle-sidebar", closeSidebar);

    return () => {
      window.removeEventListener("resize", handleResize);
      document.body.removeEventListener("toggle-sidebar", closeSidebar);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[#0e0e10] text-white">
      <Topbar toggleSidebar={toggleSidebar} />
      <div className="flex flex-1 overflow-hidden">
        <div className={`transition-all duration-300 bg-[#111] ${sidebarOpen || !isMobile ? "w-[240px]" : "w-16"}`}>
          <Sidebar isOpen={sidebarOpen || !isMobile} />
        </div>

        <main className="flex-1 overflow-y-auto p-4">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/generator" element={<Generator />} />
            <Route path="/auto-generator" element={<AutoGenerator />} />
            <Route path="/chatboard" element={<Chatboard />} />
            <Route path="/ai-image" element={<AIImage />} />
            <Route path="/plans" element={<Plans />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/connect" element={<Connect />} />
            <Route path="/editor" element={<Editor />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
