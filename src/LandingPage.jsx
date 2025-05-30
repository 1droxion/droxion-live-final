import React from "react";
import { useNavigate } from "react-router-dom";

function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f0f] to-[#111827] text-white flex flex-col items-center justify-center px-6 py-12 animate-fade-in-slow">
      <h1 className="text-5xl md:text-6xl font-extrabold mb-6 text-center">
        Welcome to <span className="text-purple-500">Droxion</span>
      </h1>
      <p className="text-xl md:text-2xl text-gray-300 text-center max-w-2xl mb-10">
        The <span className="text-green-400 font-semibold">#1 AI Reel Generator</span> — From Script to Upload in Seconds.
      </p>

      <div className="flex flex-col md:flex-row gap-6 justify-center">
        <button
          onClick={() => navigate("/generator")}
          className="px-6 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-lg rounded-2xl shadow-xl hover:scale-105 transform transition duration-300"
        >
          🚀 Try It Free Now
        </button>
        <button
          onClick={() => navigate("/projects")}
          className="px-6 py-4 bg-white text-black text-lg font-semibold rounded-2xl shadow-xl hover:scale-105 transform transition duration-300"
        >
          🎬 See AI Demo
        </button>
      </div>

      <div className="mt-16 w-full max-w-4xl bg-[#1a1a2e] p-8 rounded-2xl shadow-xl border border-gray-700 text-center">
        <h2 className="text-3xl font-bold text-purple-400 mb-4">
          What can Droxion do?
        </h2>
        <ul className="text-gray-300 space-y-2 text-lg">
          <li>✅ Generate cinematic reels in 30 seconds</li>
          <li>✅ Use AI voiceovers, subtitles, and music</li>
          <li>✅ Automate your content pipeline</li>
          <li>✅ One-click download & upload ready</li>
        </ul>
      </div>

      <p className="mt-10 text-gray-500 text-sm">Built with ❤️ for creators who demand the best.</p>
    </div>
  );
}

export default LandingPage;
