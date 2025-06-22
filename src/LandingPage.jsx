import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Particles from "@tsparticles/react";
import { loadFull } from "tsparticles";
import Typewriter from "react-simple-typewriter";
import "./LandingPageMagic.css";

function LandingPage() {
  const navigate = useNavigate();

  const particlesInit = async (main) => {
    await loadFull(main);
  };

  return (
    <div className="bg-[#0e0e10] text-white min-h-screen overflow-hidden relative">
      <Particles
        id="tsparticles"
        init={particlesInit}
        className="absolute top-0 left-0 w-full h-full z-0"
        options={{
          background: { color: { value: "#0e0e10" } },
          fpsLimit: 60,
          particles: {
            color: { value: "#ffffff" },
            links: { enable: true, color: "#888", distance: 100 },
            move: { enable: true, speed: 1 },
            number: { value: 50 },
            size: { value: 2 },
          },
          interactivity: {
            events: { onHover: { enable: true, mode: "repulse" } },
            modes: { repulse: { distance: 100, duration: 0.4 } },
          },
        }}
      />

      <div className="relative z-10 px-6 py-12 flex flex-col items-center justify-center animate-fade-in">
        <h1 className="text-5xl md:text-6xl font-extrabold mb-6 text-center">
          Welcome to <span className="text-purple-500">Droxion</span>
        </h1>

        <p className="text-xl md:text-2xl text-gray-300 text-center max-w-2xl mb-10">
          <Typewriter
            words={["Create", "Chat", "Imagine", "Generate", "Explore"]}
            loop={0}
            cursor
            cursorStyle="_"
            typeSpeed={80}
            deleteSpeed={60}
            delaySpeed={1000}
          />
        </p>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate("/chatboard")}
          className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-500 text-white text-lg rounded-full shadow-2xl transition duration-300 hover:shadow-purple-700 hover:brightness-110"
        >
          🚀 Enter the AI World
        </motion.button>

        <div className="mt-6 flex flex-col sm:flex-row gap-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/plans")}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 transition text-white rounded-full shadow-lg"
          >
            💳 View Plans
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              localStorage.setItem("droxion_plan", "Starter");
              const alreadyGiven = localStorage.getItem("starter_bonus_given");
              if (!alreadyGiven) {
                localStorage.setItem("droxion_coins", "50");
                localStorage.setItem("starter_bonus_given", "true");
                alert("✅ Starter plan activated! 50 free coins added.");
              } else {
                alert("✅ Starter plan already active.");
              }
            }}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 transition text-white rounded-full shadow-lg"
          >
            🆓 Try Starter Free
          </motion.button>
        </div>

        <div className="mt-16 max-w-4xl bg-[#1a1a2e] p-8 rounded-2xl shadow-xl border border-gray-700 text-center">
          <h2 className="text-3xl font-bold text-purple-400 mb-6">
            What can Droxion do?
          </h2>
          <ul className="text-gray-300 space-y-3 text-lg text-left">
            {[
              "✅ Chat with AI like a real assistant (3 free messages)",
              "✅ Generate 1 stunning AI image (free)",
              "✅ View trending YouTube clips instantly",
              "✅ Explore news, reels, and content",
              "✅ Earn or buy coins to unlock more",
            ].map((feature, index) => (
              <motion.li
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + index * 0.2 }}
              >
                {feature}
              </motion.li>
            ))}
          </ul>
        </div>

        <p className="mt-12 text-sm text-gray-500">
          Contact: <a href="mailto:droxionhalp@gmail.com">droxionhalp@gmail.com</a> • Powered by Droxion™
        </p>
      </div>
    </div>
  );
}

export default LandingPage;
