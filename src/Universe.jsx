import React, { useEffect, useState } from "react";

export default function Universe() {
  const [universeData, setUniverseData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUniverse = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || "https://droxion-backend.onrender.com"}/world-state`
      );
      const data = await res.json();
      setUniverseData(data);
    } catch (err) {
      console.error("🌌 Error fetching universe:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUniverse();
    const interval = setInterval(fetchUniverse, 5000); // auto-refresh every 5 sec
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-xl text-purple-300 animate-pulse">
        🌠 Loading Universe...
      </div>
    );
  }

  if (!universeData) {
    return (
      <div className="flex items-center justify-center h-screen text-red-400">
        ❌ No universe data found.
      </div>
    );
  }

  const { age, galaxies, stars, planets, blackHoles, nebulae } = universeData;

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-indigo-900 to-black text-white p-8">
      <h1 className="text-4xl md:text-6xl font-bold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-600">
        🌌 Live Universe Simulation
      </h1>

      <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto text-center text-lg">
        <div className="bg-[#1e1e2f] p-6 rounded-2xl shadow-lg">
          <h2 className="text-xl font-semibold text-cyan-300 mb-2">Age</h2>
          <p>{age} years since the Big Bang</p>
        </div>

        <div className="bg-[#1e1e2f] p-6 rounded-2xl shadow-lg">
          <h2 className="text-xl font-semibold text-pink-400 mb-2">Galaxies</h2>
          <p>{galaxies?.length || 0} galaxies formed</p>
        </div>

        <div className="bg-[#1e1e2f] p-6 rounded-2xl shadow-lg">
          <h2 className="text-xl font-semibold text-yellow-300 mb-2">Stars</h2>
          <p>{stars?.length || 0} stars burning</p>
        </div>

        <div className="bg-[#1e1e2f] p-6 rounded-2xl shadow-lg">
          <h2 className="text-xl font-semibold text-green-300 mb-2">Planets</h2>
          <p>{planets?.length || 0} planets discovered</p>
        </div>

        <div className="bg-[#1e1e2f] p-6 rounded-2xl shadow-lg">
          <h2 className="text-xl font-semibold text-red-300 mb-2">Black Holes</h2>
          <p>{blackHoles?.length || 0} active black holes</p>
        </div>

        <div className="bg-[#1e1e2f] p-6 rounded-2xl shadow-lg">
          <h2 className="text-xl font-semibold text-blue-300 mb-2">Nebulae</h2>
          <p>{nebulae?.length || 0} nebulae clouds</p>
        </div>
      </div>
    </div>
  );
}
