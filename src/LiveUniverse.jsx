import React, { useEffect, useState } from "react";
import axios from "axios";

function LiveUniverse() {
  const [events, setEvents] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    axios.get(`${import.meta.env.VITE_BACKEND_URL}/world-state`)
      .then((res) => {
        setEvents(res.data.universe.events || []);
      })
      .catch((err) => {
        console.error("Failed to fetch world state:", err);
      });
  }, []);

  useEffect(() => {
    if (events.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) =>
        prev < events.length - 1 ? prev + 1 : prev
      );
    }, 3000); // Show next event every 3 seconds

    return () => clearInterval(interval);
  }, [events]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 space-y-4">
      <h1 className="text-5xl font-bold text-purple-400 mb-10 animate-pulse">
        🌌 The Story of Our Universe
      </h1>

      {events.length > 0 && (
        <div className="max-w-3xl text-center p-8 rounded-xl bg-gradient-to-br from-gray-800 to-black shadow-2xl border border-purple-600 transition-all duration-500">
          <h2 className="text-3xl font-bold text-cyan-300 mb-2 animate-fade-in">
            {events[currentIndex].event}
          </h2>
          <p className="text-yellow-200 text-sm italic mb-4">
            {events[currentIndex].time}
          </p>
          <p className="text-lg text-white">
            {events[currentIndex].description}
          </p>
        </div>
      )}
    </div>
  );
}

export default LiveUniverse;
