import React from "react";
import Particles from "@tsparticles/react";
import { loadFull } from "tsparticles";
import { useNavigate } from "react-router-dom";
import "./LandingPageMagic.css";

function LandingPage() {
  const navigate = useNavigate();

  const particlesInit = async (main) => {
    await loadFull(main);
  };

  const handleEnter = () => {
    document.getElementById("droxion-world").classList.add("entering");
    setTimeout(() => navigate("/chatboard"), 2000);
  };

  return (
    <div className="landing-wrapper">
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
            size: { value: { min: 1, max: 5 } },
          },
          detectRetina: true,
        }}
      />

      <div id="droxion-world" className="droxion-world text-center">
        <h1 className="logo-glow">🌐 Droxion AI World</h1>
        <p className="tagline">Step into the world where AI creates your imagination</p>
        <div className="typing-indicator">
          <span>.</span><span>.</span><span>.</span>
        </div>
        <button onClick={handleEnter} className="enter-button">
          Enter AI World
        </button>
      </div>
    </div>
  );
}

export default LandingPage;
