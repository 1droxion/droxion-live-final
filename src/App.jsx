import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from "react-router-dom";
import axios from "axios";

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
import Settings from "./Settings";
import LandingPage from "./LandingPage";
import Login from "./Login";
import Signup from "./Signup";

function AppWrapper() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [credits, setCredits] = useState(null);
  const [limit, setLimit] = useState(null);
  const [authUser, setAuthUser] = useState(localStorage.getItem("authUser"));

  useEffect(() => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, [location]);

  useEffect(() => {
    if (authUser) {
      axios
        .get(`${import.meta.env.VITE_BACKEND_URL}/user-stats`)
        .then((res) => {
          setCredits(res.data.credits);
          setLimit(res.data.plan.videoLimit); // Can change to imageLimit, etc.
        })
        .catch(() => {
          setCredits(null);
          setLimit(null);
        });
    }
  }, [authUser]);

  const handleLogout = () => {
    localStorage.removeItem("authUser");
    setAuthUser(null);
    window.location.href = "/login";
  };

  const isOutOfCredits = credits !== null && limit !== null && credits >= limit;

  return (
    <div className="flex min-h-screen bg-[#0e0e10] text-white">
      {authUser && isSidebarOpen && (
        <Sidebar isOpen={isSidebarOpen} setIsOpen={setSidebarOpen} />
      )}
      <div className="flex-1 flex flex-col">
        <Topbar
          toggleSidebar={() => setSidebarOpen(!isSidebarOpen)}
          credits={credits}
          limit={limit}
          onLogout={authUser ? handleLogout : null}
          isLoggedIn={!!authUser}
        />
        <div className="p-4">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            {authUser ? (
              <>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/generator" element={<Generator />} />
                <Route path="/auto-generator" element={<AutoGenerator />} />
                <Route path="/chatboard" element={<AIChat />} />
                <Route path="/ai-image" element={<AIImage />} />
                <Route path="/plans" element={<Plans />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/templates" element={<Templates />} />
                <Route path="/connect" element={<Connect />} />
                <Route path="/editor" element={<Editor />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/settings" element={<Settings />} />
              </>
            ) : (
              <Route path="*" element={<Login />} />
            )}
          </Routes>
        </div>
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
