import React, { useEffect, useState } from "react";
import axios from "axios";

export default function LiveUniverse() {
  const [universe, setUniverse] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUniverse = async () => {
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL || "https://droxion-backend.onrender.com"}/world-state`
      );
      setUniverse(res.data);
      setLoading(false);
    } catch (err) {
      console.error("❌ Failed to fetch universe:", err);
    }
  };

  useEffect(() => {
    fetchUniverse();
    const interval = setInterval(fetchUniverse, 5000); // refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="p-6 text-white text-center text-2xl animate-pulse">
        🌌 Loading Universe...
      </div>
    );
  }

  return (
    <div className="p-6 text-white">
      <h1 className="text-4xl font-bold mb-6 text-purple-400">🌌 Live Universe</h1>

      <p className="text-sm mb-4 text-gray-400 italic">
        Evolving since: {universe.created_at} | Last update: {universe.last_updated}
      </p>

      {universe.galaxies.map((galaxy, gIndex) => (
        <div key={gIndex} className="mb-8 p-4 rounded-lg bg-gray-900 shadow-xl">
          <h2 className="text-2xl font-semibold text-cyan-400">🌀 Galaxy: {galaxy.name}</h2>

          {galaxy.stars.map((star, sIndex) => (
            <div key={sIndex} className="ml-4 mt-4">
              <h3 className="text-lg text-yellow-300">⭐ Star: {star.name}</h3>

              <div className="ml-4">
                {star.planets.map((planet, pIndex) => (
                  <div key={pIndex} className="mb-2">
                    <p className="text-green-400 font-medium">🌍 Planet: {planet.name}</p>
                    <p className="text-gray-300 ml-2 text-sm">
                      Type: {planet.type} | Life: {planet.life ? "Yes" : "No"}
                    </p>

                    {planet.civilization && (
                      <div className="ml-4 mt-1 text-sm text-pink-300">
                        👽 Civilization: {planet.civilization.name}<br />
                        Level: {planet.civilization.level}<br />
                        Status: {planet.civilization.status}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
