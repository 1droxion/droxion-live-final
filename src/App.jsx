import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

// Your Pages
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
import LandingPage from "./LandingPage";

function AppWrapper() {
  const location = useLocation();
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    // Auto-close sidebar on page change for mobile
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, [location]);

  return (
    <div className="flex min-h-screen bg-[#0e0e10] text-white">
      {isSidebarOpen && <Sidebar isOpen={isSidebarOpen} />}
      <div className="flex-1 flex flex-col">
        <Topbar toggleSidebar={() => setSidebarOpen(!isSidebarOpen)} />
        <div className="p-4">
          <Routes>
            <Route path="/" element={<LandingPage />} />
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
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppWrapper />
    </Router>
  );
}
