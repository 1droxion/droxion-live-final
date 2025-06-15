import React from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, PlayCircle, Image as ImageIcon, Brain } from "lucide-react";

function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0e0e10] to-[#1f2937] text-white flex flex-col items-center justify-center px-6 py-16 animate-fade-in-slow">
      <h1 className="text-5xl md:text-6xl font-extrabold mb-4 text-center">
        🌐 Welcome to <span className="text-purple-500">Droxion</span>
      </h1>
      <p className="text-xl md:text-2xl text-gray-300 text-center max-w-2xl mb-10">
        Your AI Superpower — <span className="text-green-400 font-semibold">Create anything in seconds</span>
      </p>

      <button
        onClick={() => navigate("/chatboard")}
        className="px-8 py-5 bg-gradient-to-r from-purple-600 via-blue-500 to-green-500 text-white text-lg rounded-full shadow-2xl hover:scale-105 transform transition duration-300 font-semibold"
      >
        🚀 Start Creating Now
      </button>

      <div className="mt-20 w-full max-w-6xl text-center">
        <h2 className="text-3xl font-bold text-purple-400 mb-8">Why Droxion Feels Like Magic ✨</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#1f2937] p-6 rounded-2xl shadow-lg border border-purple-600">
            <Sparkles size={32} className="text-purple-400 mx-auto mb-3" />
            <p className="text-xl font-bold mb-2">Instant AI Chat</p>
            <p className="text-gray-400">Get smart answers, write anything, and generate ideas effortlessly.</p>
          </div>
          <div className="bg-[#1f2937] p-6 rounded-2xl shadow-lg border border-blue-600">
            <ImageIcon size={32} className="text-blue-400 mx-auto mb-3" />
            <p className="text-xl font-bold mb-2">AI Image Creator</p>
            <p className="text-gray-400">Describe it and get stunning visuals instantly with styles like anime or cinematic.</p>
          </div>
          <div className="bg-[#1f2937] p-6 rounded-2xl shadow-lg border border-green-600">
            <PlayCircle size={32} className="text-green-400 mx-auto mb-3" />
            <p className="text-xl font-bold mb-2">Video & YouTube Genius</p>
            <p className="text-gray-400">Ask for any movie, show, or episode — or create your own video in seconds.</p>
          </div>
        </div>
      </div>

      <div className="mt-20 max-w-6xl w-full text-center">
        <h2 className="text-3xl font-bold text-green-400 mb-6">What creators are saying 💬</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#111827] p-6 rounded-xl shadow-xl">
            <p className="text-gray-300 italic">
              “It feels like magic. I made a viral reel, got AI images, and even pulled up news in one place.”
            </p>
            <p className="text-sm mt-4 text-gray-500">— Anjali, Content Creator</p>
          </div>
          <div className="bg-[#111827] p-6 rounded-xl shadow-xl">
            <p className="text-gray-300 italic">
              “I created a full series of videos and designs using just my voice. Droxion is my new co-pilot.”
            </p>
            <p className="text-sm mt-4 text-gray-500">— Karan, Designer</p>
          </div>
          <div className="bg-[#111827] p-6 rounded-xl shadow-xl">
            <p className="text-gray-300 italic">
              “Droxion is like ChatGPT, Midjourney, and CapCut combined — but better and faster.”
            </p>
            <p className="text-sm mt-4 text-gray-500">— Nisha, Social Media Manager</p>
          </div>
        </div>
      </div>

      <p className="mt-16 text-gray-500 text-sm italic">Built with ❤️ by Dhruv Patel for creators worldwide — powered by Droxion™</p>
    </div>
  );
}

export default LandingPage;
