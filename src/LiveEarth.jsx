import React, { useEffect, useState } from "react";
import axios from "axios";

function LiveEarth() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchWorld = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/world-state`);
      setState(res.data);
    } catch (err) {
      console.error("🌍 Error fetching world state:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorld();
    const interval = setInterval(fetchWorld, 5000); // refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="text-center text-white mt-20">🌀 Loading universe...</div>;

  if (!state) return <div className="text-center text-red-500 mt-20">❌ No data found</div>;

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <h1 className="text-3xl font-bold text-center mb-6">🌌 Live Universe Simulation</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
        <div className="bg-gray-900 p-5 rounded-xl border border-blue-500 shadow-lg">
          <h2 className="text-xl font-semibold text-cyan-400 mb-2">📆 Current Era</h2>
          <p className="text-lg">{state.era}</p>
        </div>
        <div className="bg-gray-900 p-5 rounded-xl border border-purple-500 shadow-lg">
          <h2 className="text-xl font-semibold text-purple-400 mb-2">🧠 Main Event</h2>
          <p className="text-lg italic">{state.event}</p>
        </div>
        <div className="bg-gray-900 p-5 rounded-xl border border-green-500 shadow-lg col-span-2">
          <h2 className="text-xl font-semibold text-green-400 mb-2">📖 Narrative</h2>
          <p className="text-base leading-relaxed">{state.description}</p>
        </div>
      </div>
    </div>
  );
}

export default LiveEarth;
