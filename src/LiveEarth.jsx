import React, { useEffect, useState } from "react";
import axios from "axios";

function LiveEarth() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/world-state`);
      setData(res.data);
      setError(null);
    } catch (err) {
      console.error("❌ Failed to fetch world state:", err);
      setError("Could not fetch live Earth data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // auto-refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="p-10 text-white">🌍 Loading Live Earth...</div>;
  if (error) return <div className="p-10 text-red-500">{error}</div>;

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-black to-gray-900 text-white">
      <h1 className="text-4xl font-bold mb-6 text-center text-blue-300 animate-pulse">
        🌐 Live Earth Simulation
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {Object.entries(data).map(([category, items]) => (
          <div key={category} className="bg-[#1f2937] p-6 rounded-xl shadow-xl">
            <h2 className="text-2xl font-semibold text-green-400 mb-4 capitalize">
              {category.replace(/_/g, ' ')}
            </h2>
            <ul className="space-y-2 list-disc list-inside text-gray-300">
              {Array.isArray(items) && items.length > 0 ? (
                items.map((item, i) => (
                  <li key={i}>{typeof item === "string" ? item : JSON.stringify(item)}</li>
                ))
              ) : (
                <li>No data yet</li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export default LiveEarth;
