import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const prompts = [
  "Make a video about success",
  "Draw an anime cityscape",
  "Tell me the latest news",
  "Create a motivational reel",
  "Show me a funny YouTube clip"
];

function LandingPage() {
  const navigate = useNavigate();
  const [currentPrompt, setCurrentPrompt] = useState("");

  useEffect(() => {
    let index = 0;
    let charIndex = 0;
    const typeEffect = () => {
      if (charIndex < prompts[index].length) {
        setCurrentPrompt((prev) => prev + prompts[index][charIndex]);
        charIndex++;
      } else {
        setTimeout(() => {
          charIndex = 0;
          setCurrentPrompt("");
          index = (index + 1) % prompts.length;
        }, 2000);
      }
    };
    const interval = setInterval(typeEffect, 80);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f0f] to-[#111827] text-white flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">

      {/* 🔵 Background Glow */}
      <div className="absolute w-[600px] h-[600px] bg-purple-700 blur-[140px] opacity-30 rounded-full -z-10 top-10 left-1/3 animate-pulse" />

      <h1 className="text-5xl md:text-6xl font-extrabold mb-4 text-center leading-tight">
        Create. Chat. Draw. <span className="text-purple-500">Inspire.</span>
      </h1>
      <p className="text-xl md:text-2xl text-gray-300 text-center max-w-2xl mb-6">
        Your All-in-One AI Creation Studio — Powered by{" "}
        <span className="text-green-400 font-semibold">Droxion™</span>
      </p>

      {/* ✨ Prompt Auto-Typing */}
      <p className="text-lg text-gray-400 italic mb-10 h-[30px]">
        {currentPrompt ? `💬 ${currentPrompt}` : ""}
      </p>

      {/* 🎯 Buttons */}
      <div className="flex flex-col md:flex-row gap-6 justify-center">
        <button
          onClick={() => navigate("/generator")}
          className="px-6 py-4 bg-gradient-to-r from-pink-500 to-red-500 text-white text-lg rounded-2xl shadow-xl hover:scale-105 transition"
        >
          🎥 Create AI Video
        </button>
        <button
          onClick={() => navigate("/chatboard")}
          className="px-6 py-4 bg-white text-black text-lg font-semibold rounded-2xl shadow-xl hover:scale-105 transition"
        >
          💬 Chat with AI
        </button>
        <button
          onClick={() => navigate("/ai-image")}
          className="px-6 py-4 bg-gradient-to-r from-green-500 to-blue-600 text-white text-lg rounded-2xl shadow-xl hover:scale-105 transition"
        >
          🎨 Generate Image
        </button>
      </div>

      {/* 🧠 What Droxion Can Do */}
      <div className="mt-20 w-full max-w-4xl bg-[#1a1a2e] p-8 rounded-2xl shadow-xl border border-gray-700 text-center">
        <h2 className="text-3xl font-bold text-purple-400 mb-4">What can Droxion do?</h2>
        <ul className="text-gray-300 space-y-2 text-lg">
          <li>✅ Generate AI images in seconds</li>
          <li>✅ Chat with AI for content, jokes, coding, facts</li>
          <li>✅ Auto-create short videos, reels, YouTube intros</li>
          <li>✅ Search & preview YouTube content directly</li>
          <li>✅ Organize projects with templates & editor</li>
        </ul>
      </div>

      {/* 💬 Testimonials */}
      <div className="mt-20 w-full max-w-5xl text-center">
        <h2 className="text-3xl font-bold text-green-400 mb-6">What users are saying 💬</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#1f2937] p-6 rounded-xl shadow-lg">
            <p className="text-gray-300 italic">
              “Droxion helped me turn ideas into viral content — in minutes.”
            </p>
            <p className="text-sm mt-4 text-gray-500">— Aditi, Creator</p>
          </div>
          <div className="bg-[#1f2937] p-6 rounded-xl shadow-lg">
            <p className="text-gray-300 italic">
              “I made my first reel using just a prompt. Mind-blowing.”
            </p>
            <p className="text-sm mt-4 text-gray-500">— Mitesh, Influencer</p>
          </div>
          <div className="bg-[#1f2937] p-6 rounded-xl shadow-lg">
            <p className="text-gray-300 italic">
              “It’s like ChatGPT + Canva + CapCut in one place!”
            </p>
            <p className="text-sm mt-4 text-gray-500">— Sarah, Editor</p>
          </div>
        </div>
      </div>

      <p className="mt-12 text-gray-500 text-sm">
        Built with ❤️ by Dhruv Patel — Powered by Droxion™
      </p>
    </div>
  );
}

export default LandingPage;
