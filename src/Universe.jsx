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
      console.error("Error fetching universe:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUniverse();
    const interval = setInterval(fetchUniverse, 5000); // Refresh every 5 sec
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="text-white p-4">🌀 Loading universe...</div>;
  if (!universeData) return <div className="text-red-400 p-4">⚠️ Universe data unavailable.</div>;

  return (
    <div className="text-white p-6 space-y-4">
      <h1 className="text-2xl font-bold text-green-400">🌌 Universe Simulation</h1>

      <div className="bg-[#1e1e22] p-4 rounded-lg shadow space-y-2">
        <p><strong>🕒 Time Since Big Bang:</strong> {universeData.time_since_big_bang}</p>
        <p><strong>💥 Current Era:</strong> {universeData.current_era}</p>
        <p><strong>🌍 Known Galaxies:</strong> {universeData.galaxies?.length || 0}</p>
        <p><strong>🌐 Known Civilizations:</strong> {universeData.civilizations?.length || 0}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#2b2b30] p-4 rounded">
          <h2 className="text-xl font-semibold mb-2">🌀 Galaxies</h2>
          <ul className="list-disc list-inside space-y-1">
            {universeData.galaxies?.map((g, i) => (
              <li key={i}>{g.name} — 🌟 {g.stars.length} stars</li>
            ))}
          </ul>
        </div>

        <div className="bg-[#2b2b30] p-4 rounded">
          <h2 className="text-xl font-semibold mb-2">🧠 Civilizations</h2>
          <ul className="list-disc list-inside space-y-1">
            {universeData.civilizations?.map((c, i) => (
              <li key={i}>{c.name} — 🌍 Planet: {c.planet}, Status: {c.status}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
