import React from "react";
import Particles from "@tsparticles/react";
import { loadFull } from "tsparticles";
import { useCallback } from "react";

export default function LiveEarth() {
  const particlesInit = useCallback(async (engine) => {
    await loadFull(engine);
  }, []);

  return (
    <div className="relative min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
      <Particles
        id="tsparticles"
        init={particlesInit}
        options={{
          fullScreen: { enable: false },
          particles: {
            number: { value: 100 },
            size: { value: 2 },
            color: { value: "#00ffcc" },
            links: { enable: true, color: "#00ffcc" },
            move: { enable: true, speed: 0.5 },
          },
        }}
        className="absolute top-0 left-0 w-full h-full z-0"
      />

      <div className="relative z-10 text-center max-w-2xl">
        <h1 className="text-4xl font-bold mb-4">🌍 Welcome to Live Earth</h1>
        <p className="text-lg mb-6">
          A fully AI-generated simulation of life — starting from the Big Bang.
          Watch civilizations evolve in real time. Join early access now.
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
            className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-md text-white font-semibold"
          >
            Join Early Access
          </button>
        </form>
      </div>
    </div>
  );
}
