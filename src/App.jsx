import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

import Landing from "./Landing";
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

function App() {
  return (
    <Router>
      <div className="flex flex-col min-h-screen bg-[#0f172a] text-white">
        <Topbar />
        <div className="flex flex-row">
          <div className="flex-grow p-4">
            <Routes>
              <Route path="/landing" element={<Landing />} />
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
          <Sidebar />
        </div>
      </div>
    </Router>
  );
}

export default App;
