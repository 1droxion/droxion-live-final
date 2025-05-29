// Step 1: Create this file as src/LandingPage.jsx

import React from "react";
import { useNavigate } from "react-router-dom";

function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 text-white flex flex-col items-center justify-center text-center px-6 py-12">
      <h1 className="text-5xl sm:text-6xl font-extrabold mb-4 animate-fade-in">
        Welcome to <span className="text-purple-500">Droxion</span>
      </h1>
      <p className="text-lg sm:text-xl text-gray-300 mb-8 animate-fade-in-slow">
        The #1 AI Reel Generator — From Script to Upload in Seconds.
      </p>
      <div className="flex flex-wrap gap-4 justify-center animate-fade-in">
        <button
          onClick={() => navigate("/generator")}
          className="px-6 py-3 bg-green-500 text-black font-semibold rounded-xl hover:bg-green-400 transition shadow-lg"
        >
          🚀 Try It Free Now
        </button>
        <button
          onClick={() => navigate("/projects")}
          className="px-6 py-3 bg-white text-black font-semibold rounded-xl hover:bg-gray-300 transition shadow-lg"
        >
          📽️ AI Reel Demo
        </button>
      </div>
    </div>
  );
}

export default LandingPage;
