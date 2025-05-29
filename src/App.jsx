import React, { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { Routes, Route } from "react-router-dom";
import Dashboard from "./Dashboard";
// import other pages...

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[#0e0e10] text-white">
      <Topbar toggleSidebar={toggleSidebar} />
      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
        <div className={`transition-all duration-300 bg-[#111] ${sidebarOpen || !isMobile ? "w-[240px]" : "w-16"}`}>
          <Sidebar isOpen={sidebarOpen || !isMobile} />
        </div>

        {/* MAIN VIEW */}
        <main className="flex-1 overflow-y-auto p-4">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            {/* Add your routes here */}
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
