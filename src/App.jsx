import React from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { SidebarProvider } from "./context/SidebarContext";
import { AnimatePresence } from "framer-motion";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

// Pages
import Home from "./Home"; // ✅ Your landing page
import Landing from "./Landing"; // Optional internal page
import Dashboard from "./Dashboard";
import Generator from "./Generator";
import AutoGenerator from "./AutoGenerator";
import AIChat from "./AIChat";
import AIImage from "./AIImage";
import Gallery from "./Gallery"; // ✅ NEW
import Plans from "./Plans";
import Projects from "./Projects";
import Templates from "./Templates";
import Connect from "./Connect";
import Editor from "./Editor";
import Profile from "./Profile";
import Settings from "./Settings";

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Home />} /> {/* ✅ Your real homepage */}
        <Route path="/landing" element={<Landing />} /> {/* optional */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/generator" element={<Generator />} />
        <Route path="/autogenerator" element={<AutoGenerator />} />
        <Route path="/aichat" element={<AIChat />} />
        <Route path="/aiimage" element={<AIImage />} />
        <Route path="/gallery" element={<Gallery />} /> {/* ✅ new public image gallery */}
        <Route path="/plans" element={<Plans />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/connect" element={<Connect />} />
        <Route path="/editor" element={<Editor />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
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
