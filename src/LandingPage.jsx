import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0e0e10] to-[#1f1f1f] text-white px-6 py-12">
      <div className="max-w-6xl mx-auto text-center">
        {/* ⚡ HERO */}
        <motion.h1
          className="text-5xl md:text-6xl font-extrabold mb-6"
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          Create Anything with <span className="text-purple-500">AI</span>
        </motion.h1>
        <motion.p
          className="text-lg md:text-2xl text-gray-300 mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          Reels, Movies, Images, YouTube, News & More — All in One Chat.
        </motion.p>
        <motion.button
          onClick={() => navigate("/chatboard")}
          className="px-8 py-4 text-lg font-bold bg-green-500 hover:bg-green-600 rounded-xl shadow-xl"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          🚀 Try Free – Ask Anything
        </motion.button>

        {/* 💡 FEATURES */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {[
            ["🎬 AI Reels from Text", "Turn any idea into a short video reel instantly."],
            ["🎨 Image Generator", "Create stunning AI visuals from simple words."],
            ["📺 YouTube Video Finder", "Ask for any video or episode – get link instantly."],
            ["📰 Real News Headlines", "Stay updated with live news from around the world."],
            ["💬 Smart AI Chat", "Write, search, code, or explore with natural chat."],
            ["🌐 Global Access", "Supports multiple languages and fast results."]
          ].map(([title, desc], i) => (
            <motion.div
              key={i}
              className="bg-[#1f2937] p-6 rounded-xl shadow-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i, duration: 0.5 }}
            >
              <h3 className="text-xl font-semibold text-purple-400 mb-2">{title}</h3>
              <p className="text-gray-400 text-sm">{desc}</p>
            </motion.div>
          ))}
        </div>

        {/* 💬 LIVE REVIEWS */}
        <div className="mt-24">
          <h2 className="text-3xl font-bold text-green-400 mb-6">What people are saying 💬</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              ["“Insane! I made a video reel in 10 seconds from a 1-line prompt.”", "Aman, YouTuber"],
              ["“Feels like ChatGPT + Canva + YouTube in one AI app. Love it.”", "Riya, Founder"],
              ["“News, images, videos, everything. This is what AI should be.”", "Dev, Developer"]
            ].map(([text, name], i) => (
              <motion.div
                key={i}
                className="bg-[#1a1a2e] p-6 rounded-xl shadow-xl"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 * i }}
              >
                <p className="text-gray-300 italic">{text}</p>
                <p className="text-sm mt-4 text-gray-500">— {name}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* 🌎 CTA */}
        <div className="mt-24 text-center">
          <h3 className="text-xl text-gray-400 mb-2">Start now – No login required</h3>
          <button
            onClick={() => navigate("/chatboard")}
            className="px-8 py-4 mt-2 bg-white text-black font-bold rounded-xl shadow-lg hover:scale-105 transition"
          >
            🔮 Launch AI Chat
          </button>
        </div>

        <p className="mt-16 text-sm text-gray-600">Powered by Droxion™ · Created by Dhruv Patel</p>
      </div>
    </div>
  );
}
