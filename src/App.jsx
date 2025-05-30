import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import Dashboard from "./Dashboard";
import Projects from "./Projects";
import Analytics from "./Analytics";
import Settings from "./Settings";
import Editor from "./Editor";
import Plans from "./Plans";
import Profile from "./Profile";
import Chatboard from "./Chatboard";
import LandingPage from "./LandingPage";
import AIImage from "./AIImage"; // ✅ Corrected name
import AutoGenerator from "./AutoGenerator"; // ✅ Corrected name

function App() {
  return (
    <Router>
      <div className="flex">
        <Sidebar />
        <div className="flex-1">
          <Topbar />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/editor" element={<Editor />} />
            <Route path="/plans" element={<Plans />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/chatboard" element={<Chatboard />} />
            <Route path="/auto-generator" element={<AutoGenerator />} /> {/* ✅ FIXED */}
            <Route path="/ai-image" element={<AIImage />} /> {/* ✅ FIXED */}
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
