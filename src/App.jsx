import React from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
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
import Login from "./Login";
import Signup from "./Signup";
import Settings from "./Settings";
import LandingPage from "./LandingPage";
import Analytics from "./Analytics";

function AppWrapper() {
  const location = useLocation();

  const hideSidebarRoutes = ["/login", "/signup"];
  const showSidebar = !hideSidebarRoutes.includes(location.pathname);

  return (
    <div className="flex">
      {showSidebar && <Sidebar />}
      <div className="flex-1">
        <Topbar />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/generator" element={<Generator />} />
          <Route path="/autogenerator" element={<AutoGenerator />} />
          <Route path="/aichat" element={<AIChat />} />
          <Route path="/aiimage" element={<AIImage />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/connect" element={<Connect />} />
          <Route path="/editor" element={<Editor />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/analytics" element={<Analytics />} />
        </Routes>
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
