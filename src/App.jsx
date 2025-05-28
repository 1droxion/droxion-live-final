import React from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { SidebarProvider } from "./context/SidebarContext";
import { AnimatePresence } from "framer-motion";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

// Pages
import Home from "./Home";
import Landing from "./Landing";
import Dashboard from "./Dashboard";
import Generator from "./Generator";
import AutoGenerator from "./AutoGenerator";
import AIChat from "./AIChat";
import AIImage from "./AIImage";
import Gallery from "./Gallery";
import Plans from "./Plans";
import Projects from "./Projects";
import Templates from "./Templates";
import Connect from "./Connect";
import Editor from "./Editor";
import Profile from "./Profile";
import Settings from "./Settings"; // ✅ make sure this file exists in /src

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Home />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/generator" element={<Generator />} />
        <Route path="/autogenerator" element={<AutoGenerator />} />
        <Route path="/aichat" element={<AIChat />} />
        <Route path="/aiimage" element={<AIImage />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/plans" element={<Plans />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/connect" element={<Connect />} />
        <Route path="/editor" element={<Editor />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} /> {/* 💡 This is working now */}
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <SidebarProvider>
      <Router>
        <Sidebar />
        <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors duration-300">
          <Topbar />
          <AnimatedRoutes />
        </div>
      </Router>
    </SidebarProvider>
  );
}

export default App;
