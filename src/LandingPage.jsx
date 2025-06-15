import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f0f] to-[#111827] text-white flex flex-col items-center justify-center px-6 py-12 overflow-hidden relative">
      {/* Background animated orbs */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute w-[600px] h-[600px] bg-purple-600 rounded-full blur-3xl opacity-30 top-[-100px] left-[-100px] animate-pulse"></div>
        <div className="absolute w-[500px] h-[500px] bg-green-400 rounded-full blur-3xl opacity-20 bottom-[-100px] right-[-100px] animate-pulse delay-1000"></div>
      </div>

      <motion.h1
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
        className="text-5xl md:text-6xl font-extrabold mb-6 text-center"
      >
        Welcome to <span className="text-purple-500">Droxion</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.4 }}
        className="text-xl md:text-2xl text-gray-300 text-center max-w-2xl mb-12"
      >
        One Chat. Endless Possibilities. Create images, videos, movies, news & more — all from AI.
      </motion.p>

      <motion.button
        onClick={() => navigate("/chatboard")}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.8 }}
        className="px-10 py-5 bg-gradient-to-r from-purple-500 to-green-500 text-white text-xl font-semibold rounded-full shadow-lg hover:scale-105 transform transition duration-300"
      >
        🚀 Enter AI World
      </motion.button>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="mt-20 text-gray-400 text-sm text-center"
      >
        Built for creators, dreamers, and the future. 💡
      </motion.div>
    </div>
  );
}
