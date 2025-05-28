import React from "react";
import { Link } from "react-router-dom";

function Home() {
  return (
    <div className="min-h-screen bg-[#0f172a] text-white px-6 py-12 flex flex-col items-center justify-center text-center">
      <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
        Welcome to <span className="text-green-400">Droxion</span>
      </h1>
      <p className="text-gray-300 text-lg max-w-xl mb-8">
        Your all-in-one AI content studio for generating Reels, Images, Scripts & more — powered by GPT, ElevenLabs, and FFmpeg.
      </p>

      {/* CTA Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          to="/generator"
          className="bg-green-500 hover:bg-green-600 text-black font-semibold px-6 py-3 rounded-lg transition shadow-lg"
        >
          🎥 Try Generator
        </Link>
        <Link
          to="/plans"
          className="bg-white text-black font-semibold px-6 py-3 rounded-lg transition hover:bg-gray-200 shadow-lg"
        >
          🚀 Get Started Free
        </Link>
      </div>

      {/* Hero Image */}
      <div className="mt-12">
        <img
          src="https://media.giphy.com/media/5VKbvrjxpVJCM/giphy.gif"
          alt="AI Preview"
          className="w-full max-w-xl rounded-xl shadow-2xl border border-gray-700"
        />
      </div>

      {/* Footer */}
      <p className="mt-12 text-sm text-gray-500">
        © {new Date().getFullYear()} Droxion™ – All rights reserved.
      </p>
    </div>
  );
}

export default Home;
