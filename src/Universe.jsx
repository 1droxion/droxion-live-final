import React, { useEffect, useState } from "react";

export default function LiveUniverse() {
  const [universeData, setUniverseData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUniverse = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || "https://droxion-backend.onrender.com"}/world-state`
      );
      const data = await res.json();
      setUniverseData(data.universe);
    } catch (err) {
      console.error("❌ Error fetching universe data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUniverse();
    const interval = setInterval(fetchUniverse, 10000); // Refresh every 10 sec
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-xl text-gray-400 animate-pulse">🌌 Loading Universe...</div>;
  }

  if (!universeData) {
    return <div className="p-8 text-center text-red-400">❌ Failed to load universe data.</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto text-white">
      <h1 className="text-4xl font-bold text-center mb-8 text-blue-400">🌌 Evolution of the Universe</h1>
      <p className="text-center text-sm text-gray-400 mb-10">Age: {universeData.age}</p>

      <div className="space-y-6">
        {universeData.events.map((event, index) => (
          <div
            key={index}
            className="bg-[#1e293b] border border-blue-500 rounded-2xl p-5 shadow-xl hover:scale-[1.01] transition-transform"
          >
            <div className="text-green-400 text-sm font-mono mb-1">{event.time}</div>
            <div className="text-xl font-semibold text-blue-300">{event.event}</div>
            <div className="text-gray-300 mt-1">{event.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
