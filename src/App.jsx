import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

import LandingPage from "./LandingPage";
import Dashboard from "./Dashboard";
import Generator from "./Generator";
import AutoGenerator from "./AutoGenerator";
import AIImage from "./AIImage";
import Chatboard from "./Chatboard";
import Plans from "./Plans";
import Projects from "./Projects";
import Templates from "./Templates";
import Connect from "./Connect";
import Editor from "./Editor";
import Profile from "./Profile";
import Settings from "./Settings";

function App() {
  return (
    <Router>
      <div className="flex h-screen bg-[#0e0e10] text-white">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-4">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/generator" element={<Generator />} />
              <Route path="/autogenerator" element={<AutoGenerator />} />
              <Route path="/aiimage" element={<AIImage />} />
              <Route path="/chatboard" element={<Chatboard />} />
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
