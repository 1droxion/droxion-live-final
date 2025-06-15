// ✅ LandingPage.jsx (Updated for live feel)
import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0e0e10] to-[#1a1a1a] text-white flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* Glow orbs */}
      <div className="absolute top-[-100px] left-[-100px] w-[300px] h-[300px] bg-purple-700 rounded-full blur-3xl opacity-30 animate-pulse" />
      <div className="absolute bottom-[-100px] right-[-100px] w-[300px] h-[300px] bg-green-500 rounded-full blur-3xl opacity-20 animate-pulse" />

      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-5xl md:text-6xl font-extrabold mb-6 text-center"
      >
        Welcome to <span className="text-purple-500">Droxion</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-xl md:text-2xl text-gray-300 text-center max-w-2xl mb-10"
      >
        The Ultimate AI Studio: <span className="text-green-400 font-semibold">Chat. Create. Generate.</span>
      </motion.p>

      <motion.button
        onClick={() => navigate("/chatboard")}
        whileHover={{ scale: 1.05 }}
        className="px-8 py-4 bg-gradient-to-r from-green-500 to-blue-600 text-white text-lg rounded-2xl shadow-xl hover:shadow-2xl"
      >
        🚀 Launch Smart AI Chat
      </motion.button>

      {/* Features */}
      <div className="mt-20 w-full max-w-4xl bg-[#1a1a2e] p-8 rounded-2xl shadow-xl border border-gray-700 text-center">
        <h2 className="text-3xl font-bold text-purple-400 mb-4">What Can Droxion Do?</h2>
        <ul className="text-gray-300 space-y-2 text-lg">
          <li>✅ Generate high-quality AI images</li>
          <li>✅ Create short videos or movies with AI</li>
          <li>✅ Ask any question, get smart AI replies</li>
          <li>✅ Watch YouTube or trending videos inside chat</li>
          <li>✅ Get real-time news & updates from the web</li>
        </ul>
      </div>

      {/* Testimonials */}
      <div className="mt-16 w-full max-w-5xl text-center">
        <h2 className="text-3xl font-bold text-green-400 mb-6">What people are saying 💬</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {["Amazing AI, changed my workflow!", "It’s magic for creatives.", "My go-to tool now."].map((text, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 * i }}
              className="bg-[#1f2937] p-6 rounded-xl shadow-lg"
            >
              <p className="text-gray-300 italic">“{text}”</p>
              <p className="text-sm mt-4 text-gray-500">— User {i + 1}</p>
            </motion.div>
          ))}
        </div>
      </div>

      <p className="mt-12 text-gray-500 text-sm">Built with ❤️ for creators who demand the future.</p>
    </div>
  );
}
