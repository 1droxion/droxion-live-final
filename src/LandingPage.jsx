import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import "./LandingPageMagic.css";

function LandingPage() {
  const navigate = useNavigate();
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowIntro(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="bg-[#0e0e10] text-white min-h-screen overflow-hidden">
      <AnimatePresence>
        {showIntro && (
          <motion.div
            key="intro"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 1.5 } }}
            className="intro-screen flex items-center justify-center h-screen bg-gradient-to-br from-[#0f0f0f] to-[#111827] relative z-50"
          >
            <div className="text-center">
              <motion.h1
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1.1, opacity: 1 }}
                transition={{ duration: 1 }}
                className="text-5xl md:text-6xl font-bold text-purple-500 drop-shadow-lg"
              >
                Droxion™
              </motion.h1>
              <p className="mt-4 text-lg text-gray-400 animate-blink">.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!showIntro && (
        <div className="px-6 py-12 flex flex-col items-center justify-center animate-fade-in">
          <h1 className="text-5xl md:text-6xl font-extrabold mb-6 text-center">
            Welcome to <span className="text-purple-500">Droxion</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 text-center max-w-2xl mb-10">
            Step into the Future — <span className="text-green-400 font-semibold">Create, Chat & Imagine</span>
          </p>

          <button
            onClick={() => navigate("/chatboard")}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-500 text-white text-lg rounded-full shadow-xl hover:scale-105 transition duration-300"
          >
            🚀 Enter the AI World
          </button>

          <div className="mt-16 max-w-4xl bg-[#1a1a2e] p-8 rounded-2xl shadow-xl border border-gray-700 text-center">
            <h2 className="text-3xl font-bold text-purple-400 mb-4">
              What can Droxion do?
            </h2>
            <ul className="text-gray-300 space-y-2 text-lg text-left">
              <li>✅ Chat with AI like a real assistant</li>
              <li>✅ Generate videos from a single idea</li>
              <li>✅ Draw stunning AI images instantly</li>
              <li>✅ Watch trending YouTube clips from one place</li>
              <li>✅ Explore news, ideas, and content magically</li>
            </ul>
          </div>

          <p className="mt-12 text-sm text-gray-500">
            Created by Dhruv Patel • Powered by Droxion™
          </p>
        </div>
      )}
    </div>
  );
}

export default LandingPage;
