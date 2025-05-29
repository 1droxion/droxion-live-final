import React from "react";
import { useNavigate } from "react-router-dom";

function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black text-white px-6 py-12 flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-6 text-center animate-fade-in">Droxion</h1>
      <p className="text-lg text-center max-w-2xl mb-10 animate-fade-in-slow">
        Create stunning AI reels in seconds. Script, voice, music, captions — all automated.
      </p>
      <button
        onClick={() => navigate("/dashboard")}
        className="bg-green-500 hover:bg-green-600 transition px-6 py-3 rounded-xl text-black font-semibold shadow-xl animate-bounce-slow"
      >
        🚀 Try It Free
      </button>
    </div>
  );
}

export default Landing;
