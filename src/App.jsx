import React, { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { Routes, Route } from "react-router-dom";
import Dashboard from "./Dashboard"; // Replace this with Landing if you have one
// import Landing from "./Landing"; // ← if using a custom landing page

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    const closeSidebar = () => setSidebarOpen(false);

    window.addEventListener("resize", handleResize);
    document.body.addEventListener("toggle-sidebar", closeSidebar);

    return () => {
      window.removeEventListener("resize", handleResize);
      document.body.removeEventListener("toggle-sidebar", closeSidebar);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[#0e0e10] text-white">
      <Topbar toggleSidebar={toggleSidebar} />
      <div className="flex flex-1 overflow-hidden">
        <div className={`transition-all duration-300 bg-[#111] ${sidebarOpen || !isMobile ? "w-[240px]" : "w-16"}`}>
          <Sidebar isOpen={sidebarOpen || !isMobile} />
        </div>

        <main className="flex-1 overflow-y-auto p-4">
          <Routes>
            <Route path="/" element={<Dashboard />} /> {/* Default fallback */}
            <Route path="/dashboard" element={<Dashboard />} />
            {/* Add other routes here */}
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
