import React, { useEffect, useState } from "react";

function Analytics() {
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    fetch("http://localhost:5000/videos")
      .then((res) => res.json())
      .then((data) => setVideos(data.reverse()))
      .catch((err) => console.error("❌ Error loading analytics:", err));
  }, []);

  const totalVideos = videos.length;
  const totalLength = (totalVideos * 25).toFixed(1); // fake avg duration

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-6">
      <h1 className="text-2xl font-bold text-green-400 mb-6">📊 Video Analytics</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#1e293b] p-6 rounded shadow">
          <h2 className="text-lg font-semibold">📦 Total Videos</h2>
          <p className="text-4xl font-bold text-blue-400">{totalVideos}</p>
        </div>

        <div className="bg-[#1e293b] p-6 rounded shadow">
          <h2 className="text-lg font-semibold">⏱️ Estimated Total Watch Time</h2>
          <p className="text-4xl font-bold text-purple-400">{totalLength} sec</p>
        </div>
      </div>

      <h2 className="mt-10 mb-4 text-xl font-bold">📈 Recent Activity</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {videos.slice(0, 6).map((video) => (
          <div key={video.filename} className="bg-[#1e293b] p-4 rounded">
            <video
              src={`http://localhost:5000/videos/${video.filename}`}
              controls
              className="w-full h-48 mb-2 rounded"
            />
            <p className="text-sm text-gray-300">🎯 {video.topic} | 📅 {video.date}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Analytics;
