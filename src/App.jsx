import React, { useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import Dashboard from "./Dashboard";
import Projects from "./Projects";
import Editor from "./Editor";
import Plans from "./Plans";
import Profile from "./Profile";
import Chatboard from "./Chatboard";
import Settings from "./Settings";
import LandingPage from "./LandingPage";

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const hideSidebarRoutes = ["/", "/login", "/signup"];
  const shouldHideSidebar = hideSidebarRoutes.includes(location.pathname);

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)]">
      {!shouldHideSidebar && isSidebarOpen && (
        <Sidebar toggleSidebar={toggleSidebar} />
      )}
      <div className="flex-1 flex flex-col">
        {!shouldHideSidebar && (
          <Topbar toggleSidebar={toggleSidebar} />
        )}
        <div className="p-4">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/editor" element={<Editor />} />
            <Route path="/plans" element={<Plans />} />
            <Route path="/chatboard" element={<Chatboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default App;
