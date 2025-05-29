import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Topbar from "./Topbar";
import Sidebar from "./Sidebar";

// Pages
import Landing from "./Landing";
import Dashboard from "./Dashboard";
import Generator from "./Generator";
import AutoGenerator from "./AutoGenerator";
import Chatboard from "./Chatboard";
import AIImage from "./AIImage";
import Projects from "./Projects";
import Templates from "./Templates";
import Connect from "./Connect";
import Editor from "./Editor";
import Profile from "./Profile";
import Settings from "./Settings";
import Login from "./Login";
import Plans from "./Plans";

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <Router>
      <div className="min-h-screen bg-[#0e0e10] text-white">
        <Topbar toggleSidebar={toggleSidebar} />
        <div className="flex">
          {sidebarOpen && <Sidebar />}
          <div className="flex-1 p-4">
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/generator" element={<Generator />} />
              <Route path="/auto-generator" element={<AutoGenerator />} />
              <Route path="/chatboard" element={<Chatboard />} />
              <Route path="/ai-image" element={<AIImage />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/templates" element={<Templates />} />
              <Route path="/connect" element={<Connect />} />
              <Route path="/editor" element={<Editor />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/login" element={<Login />} />
              <Route path="/plans" element={<Plans />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;
