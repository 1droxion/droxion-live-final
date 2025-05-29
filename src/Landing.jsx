import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-black to-[#0e0e10] text-white flex flex-col items-center justify-center px-6 animate-fade-in-slow">
      <h1 className="text-5xl md:text-6xl font-extrabold mb-6 text-center drop-shadow-md">
        Droxion
      </h1>
      <p className="text-lg md:text-xl max-w-2xl text-center text-zinc-300 mb-8">
        Create Stunning AI Reels in Seconds. Script. Voice. Music. Captions.
        Everything done automatically for you by AI.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <Button
          className="px-6 py-3 bg-green-500 hover:bg-green-400 text-black text-lg rounded-xl shadow-lg"
          onClick={() => navigate("/generator")}
        >
          🚀 Try It Free Now
        </Button>
        <Button
          variant="ghost"
          className="text-white border border-zinc-600 hover:bg-zinc-800 text-lg px-6 py-3 rounded-xl"
          onClick={() => navigate("/chatboard")}
        >
          🤖 AI Reel Demo
        </Button>
      </div>

      <p className="text-sm text-zinc-400 mt-10">Trusted by creators from around the world</p>
    </div>
  );
}

export default LandingPage;
