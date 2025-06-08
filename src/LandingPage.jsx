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
        Your All-in-One AI Creation Studio — <span className="text-green-400 font-semibold">Generate. Chat. Create.</span>
      </p>

      <div className="flex flex-col md:flex-row gap-6 justify-center">
        <button
          onClick={() => navigate("/ai-image")}
          className="px-6 py-4 bg-gradient-to-r from-green-500 to-blue-600 text-white text-lg rounded-2xl shadow-xl hover:scale-105 transform transition duration-300"
        >
          🎨 Try AI Image Generator
        </button>
        <button
          onClick={() => navigate("/chatboard")}
          className="px-6 py-4 bg-white text-black text-lg font-semibold rounded-2xl shadow-xl hover:scale-105 transform transition duration-300"
        >
          💬 Ask AI Anything
        </button>
      </div>

      <div className="mt-16 w-full max-w-4xl bg-[#1a1a2e] p-8 rounded-2xl shadow-xl border border-gray-700 text-center">
        <h2 className="text-3xl font-bold text-purple-400 mb-4">
          What can Droxion do?
        </h2>
        <ul className="text-gray-300 space-y-2 text-lg">
          <li>✅ Generate high-quality AI images instantly</li>
          <li>✅ Get instant answers & content from AI Chatboard</li>
          <li>✅ Use smart templates for creative workflows</li>
          <li>✅ Manage your projects and content seamlessly</li>
          <li>✅ Full-featured editor for precise customization</li>
        </ul>
      </div>

      <div className="mt-16 w-full max-w-5xl text-center">
        <h2 className="text-3xl font-bold text-green-400 mb-6">What people are saying 💬</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#1f2937] p-6 rounded-xl shadow-lg">
            <p className="text-gray-300 italic">
              “Droxion helped me turn ideas into viral content — in minutes. Game changer.”
            </p>
            <p className="text-sm mt-4 text-gray-500">— Aditi, Content Creator</p>
          </div>
          <div className="bg-[#1f2937] p-6 rounded-xl shadow-lg">
            <p className="text-gray-300 italic">
              “From AI images to smart editing, this is the future of creative automation.”
            </p>
            <p className="text-sm mt-4 text-gray-500">— Rahul, Startup Founder</p>
          </div>
          <div className="bg-[#1f2937] p-6 rounded-xl shadow-lg">
            <p className="text-gray-300 italic">
              “Simple. Powerful. Automated. Droxion is my daily tool now.”
            </p>
            <p className="text-sm mt-4 text-gray-500">— Sara, Freelance Designer</p>
          </div>
        </div>
      </div>

      <p className="mt-12 text-gray-500 text-sm">
        Built with ❤️ for creators who demand the best.
      </p>
    </div>
  );
}

export default LandingPage;
