import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import Dashboard from "./Dashboard";
import Generator from "./Generator";
import AutoGenerator from "./AutoGenerator";
import AIChat from "./AIChat";
import AIImage from "./AIImage";
import Plans from "./Plans";
import Projects from "./Projects";
import Templates from "./Templates";
import Connect from "./Connect";
import Editor from "./Editor";
import Profile from "./Profile";
import Settings from "./Settings";
import LandingPage from "./LandingPage";

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <Router>
      <div className="flex h-screen bg-[#0e0e10] text-white">
        <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
        <div className="flex-1 flex flex-col">
          <Topbar toggleSidebar={toggleSidebar} />
          <main className="flex-1 overflow-y-auto p-4">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/generator" element={<Generator />} />
              <Route path="/auto-generator" element={<AutoGenerator />} />
              <Route path="/chatboard" element={<AIChat />} />
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
    </Router>
  );
}

export default App;
