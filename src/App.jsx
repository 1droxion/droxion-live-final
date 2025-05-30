import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

import Dashboard from "./Dashboard";
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
import Generator from "./Generator";
import Analytics from "./Analytics";
import Login from "./Login";
import Signup from "./Signup";

function MainLayout() {
  const location = useLocation();
  const hideSidebarRoutes = ["/", "/login", "/signup"];
  const showSidebar = !hideSidebarRoutes.includes(location.pathname);

  return (
    <div className="flex h-screen">
      {showSidebar && <Sidebar />}
      <div className="flex-1 flex flex-col">
        <Topbar />
        <div className="p-4 flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/autogenerator" element={<AutoGenerator />} />
            <Route path="/generator" element={<Generator />} />
            <Route path="/aichat" element={<AIChat />} />
            <Route path="/aiimage" element={<AIImage />} />
            <Route path="/plans" element={<Plans />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/connect" element={<Connect />} />
            <Route path="/editor" element={<Editor />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <MainLayout />
    </Router>
  );
}
