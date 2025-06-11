import React, { useEffect, useState } from "react";
import axios from "axios";

function LiveEarth() {
  const [world, setWorld] = useState(null);

  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_BACKEND_URL}/world-state`)
      .then((res) => setWorld(res.data))
      .catch((err) => {
        console.error("Failed to fetch world state:", err);
        setWorld(null);
      });
  }, []);

  const renderSection = (title, items) => (
    <div className="bg-[#1e293b] p-6 rounded-xl shadow-lg w-full md:w-[48%] mb-4">
      <h2 className="text-xl font-bold text-green-400 mb-3">{title}</h2>
      {(!items || items.length === 0) ? (
        <p className="text-gray-400">• No data yet</p>
      ) : (
        <ul className="text-sm text-white space-y-2 list-disc list-inside">
          {items.map((item, i) => (
            <li key={i}>
              {typeof item === "string" ? item : JSON.stringify(item)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="min-h-screen px-4 py-10 bg-gradient-to-br from-black via-[#0f0f23] to-black text-white">
      <h1 className="text-4xl font-extrabold text-center text-blue-300 mb-10">
        🌍 Live Earth Simulation
      </h1>

      {!world ? (
        <p className="text-center text-gray-500">Loading...</p>
      ) : (
        <div className="flex flex-wrap justify-center gap-4 max-w-6xl mx-auto">
          {renderSection("Day", [world.day])}
          {renderSection("Weather", [world.weather])}
          {renderSection("Economy", [world.economy])}
          {renderSection("Politics", [world.politics])}
          {renderSection("Humans", world.humans)}
        </div>
      )}
    </div>
  );
}

export default LiveEarth;
