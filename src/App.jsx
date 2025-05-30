import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import Dashboard from "./Dashboard";
import Projects from "./Projects";
import Analytics from "./Analytics";
import Settings from "./Settings";
import Editor from "./Editor";
import Plans from "./Plans";
import Profile from "./Profile";
import Generator from "./Generator";
import AutoGenerator from "./AutoGenerator";
import Chatboard from "./Chatboard";
import ImageGenerator from "./ImageGenerator";
import Templates from "./Templates";
import Connect from "./Connect";
import LandingPage from "./LandingPage"; // ✅

function AppRoutes({ onNavigate }) {
  const location = useLocation();

  // Auto close sidebar on route change
  React.useEffect(() => {
    onNavigate();
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/projects" element={<Projects />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/editor" element={<Editor />} />
      <Route path="/plans" element={<Plans />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/generator" element={<Generator />} />
      <Route path="/auto-generator" element={<AutoGenerator />} />
      <Route path="/chatboard" element={<Chatboard />} />
      <Route path="/ai-image" element={<ImageGenerator />} />
      <Route path="/templates" element={<Templates />} />
      <Route path="/connect" element={<Connect />} />
    </Routes>
  );
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <Router>
      <div className="flex h-screen bg-[#0e0e10] text-white">
        <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
        <div className="flex flex-col flex-1">
          <Topbar toggleSidebar={toggleSidebar} />
          <main className="flex-1 overflow-y-auto p-4">
            <AppRoutes onNavigate={closeSidebar} />
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;
