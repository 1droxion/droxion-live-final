import React from "react";
import Particles from "@tsparticles/react";
import { loadFull } from "tsparticles";
import { useNavigate } from "react-router-dom";

function LandingPage() {
  const navigate = useNavigate();

  const particlesInit = async (main) => {
    await loadFull(main);
  };

  const handleEnter = () => {
    const box = document.getElementById("droxion-world");
    box.classList.add("animate-fade-out");
    setTimeout(() => navigate("/chatboard"), 1800);
  };

  return (
    <div className="relative w-full h-screen bg-black text-white overflow-hidden">
      <Particles
        id="tsparticles"
        init={particlesInit}
        options={{
          background: { color: { value: "#0e0e10" } },
          fpsLimit: 60,
          interactivity: {
            events: { onHover: { enable: true, mode: "repulse" } },
            modes: { repulse: { distance: 100, duration: 0.4 } },
          },
          particles: {
            color: { value: "#ffffff" },
            links: { color: "#ffffff", distance: 150, enable: true, opacity: 0.5, width: 1 },
            move: { enable: true, speed: 2 },
            number: { density: { enable: true, area: 800 }, value: 80 },
            opacity: { value: 0.5 },
            shape: { type: "circle" },
            size: { value: { min: 1, max: 4 } },
          },
          detectRetina: true,
        }}
      />

      <div
        id="droxion-world"
        className="absolute inset-0 flex flex-col items-center justify-center text-center z-10 transition-all duration-700"
      >
        <h1 className="text-4xl md:text-5xl font-extrabold text-purple-500 drop-shadow-lg mb-4">
          🌐 Droxion AI World
        </h1>
        <p className="text-lg md:text-xl text-gray-300 mb-6">
          Step into the world where AI creates your imagination
        </p>

        <div className="flex items-center justify-center gap-1 text-3xl text-white mb-8 animate-pulse">
          <span className="animate-bounce">.</span>
          <span className="animate-bounce delay-150">.</span>
          <span className="animate-bounce delay-300">.</span>
        </div>

        <button
          onClick={handleEnter}
          className="bg-green-500 hover:bg-green-600 text-white text-lg px-6 py-3 rounded-xl font-semibold transition-transform hover:scale-105 shadow-lg"
        >
          🚀 Enter AI World
        </button>
      </div>
    </div>
  );
}

export default LandingPage;
