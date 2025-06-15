import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#0e0e10] to-[#1a1a1a] text-white overflow-hidden flex flex-col items-center justify-center px-6 py-16">
      {/* 🔮 Background Orbs */}
      <div className="absolute w-full h-full top-0 left-0 pointer-events-none overflow-hidden">
        <div className="absolute w-72 h-72 bg-purple-500 opacity-20 rounded-full top-10 left-10 animate-pulse blur-3xl" />
        <div className="absolute w-96 h-96 bg-green-400 opacity-20 rounded-full bottom-20 right-20 animate-ping blur-3xl" />
        <div className="absolute w-60 h-60 bg-blue-500 opacity-20 rounded-full bottom-0 left-1/2 transform -translate-x-1/2 animate-pulse blur-2xl" />
      </div>

      {/* 💫 Title and CTA */}
      <motion.h1
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-5xl md:text-6xl font-extrabold text-center mb-4 z-10"
      >
        Welcome to <span className="text-purple-500">Droxion</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.8 }}
        className="text-xl md:text-2xl text-gray-300 text-center max-w-2xl mb-10 z-10"
      >
        The Future of AI Creation — <span className="text-green-400 font-semibold">Images. Videos. Movies. Everything.</span>
      </motion.p>

      <motion.button
        onClick={() => navigate("/chatboard")}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.8, duration: 0.6, type: "spring", stiffness: 120 }}
        className="px-8 py-5 bg-gradient-to-r from-green-500 to-blue-600 text-white text-xl font-semibold rounded-2xl shadow-xl hover:scale-105 transition transform z-10"
      >
        🚀 Enter AI World
      </motion.button>

      {/* ✨ Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-10 text-sm text-gray-500 text-center z-10"
      >
        Built by Dhruv Patel • Powered by Droxion™ AI
      </motion.p>
    </div>
  );
}

export default LandingPage;
