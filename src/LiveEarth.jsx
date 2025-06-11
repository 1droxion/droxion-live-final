import React, { useEffect, useState } from "react";
import axios from "axios";

function LiveEarth() {
  const [world, setWorld] = useState(null);

  useEffect(() => {
    const fetchWorld = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/live-earth`);
        setWorld(res.data);
      } catch (err) {
        console.error("❌ Failed to fetch world state:", err);
      }
    };

    fetchWorld(); // First fetch
    const interval = setInterval(fetchWorld, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval); // Cleanup on unmount
  }, []);

  if (!world) {
    return <div className="text-white text-center mt-20">🌍 Loading Live Earth...</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center">
      <h1 className="text-4xl font-bold text-cyan-400 mb-4">🌍 Live Earth - Day {world.day}</h1>
      <div className="mb-6 text-lg text-purple-300">
        Weather: {world.weather} | Market: {world.economy.marketTrend} | GDP: ${world.economy.globalGDP}
      </div>
      <div className="mb-4 text-yellow-300 italic">📰 {world.politics.majorEvent}</div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-6xl">
        {world.humans.map((h, i) => (
          <div
            key={i}
            className="p-4 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 shadow-lg border border-purple-600"
          >
            <h2 className="text-xl font-semibold text-green-400">{h.name}</h2>
            <p>Age: {h.age}</p>
            <p>Location: {h.location}</p>
            <p>Job: {h.job}</p>
            <p>Money: ${h.money}</p>
            <p className="italic text-pink-400">Mood: {h.emotion}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default LiveEarth;
