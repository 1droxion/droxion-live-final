import React from "react";
import Particles from "@tsparticles/react";
import { loadFull } from "tsparticles";
import { useCallback } from "react";

export default function LiveEarth() {
  const particlesInit = useCallback(async (engine) => {
    await loadFull(engine);
  }, []);

  return (
    <div className="relative min-h-screen bg-black text-white flex items-center justify-center overflow-hidden">
      {/* Particle Background */}
      <Particles
        id="tsparticles"
        init={particlesInit}
        options={{
          fullScreen: { enable: false },
          particles: {
            number: { value: 150 },
            size: { value: 1.5 },
            color: { value: "#00ffff" },
            links: { enable: true, color: "#00ffff", opacity: 0.2 },
            move: { enable: true, speed: 0.6 },
          },
        }}
        className="absolute top-0 left-0 w-full h-full z-0"
      />

      {/* Main Content */}
      <div className="relative z-10 max-w-2xl text-center bg-white/5 backdrop-blur-lg p-10 rounded-2xl border border-white/10 shadow-xl animate-fade-in">
        <img
          src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/The_Earth_seen_from_Apollo_17.jpg/480px-The_Earth_seen_from_Apollo_17.jpg"
          alt="Earth"
          className="w-20 h-20 mx-auto mb-4 animate-bounce-slow rounded-full shadow-lg"
        />

        <h1 className="text-3xl md:text-4xl font-extrabold mb-4 tracking-wide text-white animate-slide-up">
          🌍 Witness the Birth of a New World
        </h1>

        <p className="text-lg text-gray-300 mb-6 leading-relaxed animate-fade-in-slow">
          An AI-powered universe starting from the Big Bang.<br />
          Real-time civilizations, stories, evolution — forever unfolding.
        </p>

        <form
          action="https://formspree.io/f/xwpblnjw"
          method="POST"
          className="flex flex-col md:flex-row gap-4 justify-center"
        >
          <input
            type="email"
            name="email"
            placeholder="Enter your email"
            required
            className="p-3 rounded-md text-black w-64"
          />
          <button
            type="submit"
            className="bg-gradient-to-r from-green-400 to-blue-500 hover:from-green-500 hover:to-blue-600 px-6 py-3 rounded-md text-white font-bold shadow-lg transform hover:scale-105 transition-all duration-300"
          >
            Join Early Access
          </button>
        </form>
      </div>
    </div>
  );
}
