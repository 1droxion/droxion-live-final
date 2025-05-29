import React, { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { Routes, Route } from "react-router-dom";
import Dashboard from "./Dashboard"; // and all your pages...

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="flex flex-col h-screen bg-[#0e0e10] text-white">
      <Topbar toggleSidebar={toggleSidebar} />
      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
        <div className={`transition-all duration-300 ${sidebarOpen ? 'w-[240px]' : 'w-16'} overflow-hidden`}>
          <Sidebar isOpen={sidebarOpen} />
        </div>

        {/* MAIN VIEW */}
        <main className="flex-1 overflow-y-auto p-4">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            {/* Add other routes here */}
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
