// src/Projects.jsx
import React, { useEffect, useState } from "react";

function Projects() {
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("droxion_videos") || "[]");
    setVideos(stored);
  }, []);

  const handleDelete = (index) => {
    const updated = [...videos];
    updated.splice(index, 1);
    setVideos(updated);
    localStorage.setItem("droxion_videos", JSON.stringify(updated));
  };

  return (
    <div className="p-6 text-white min-h-screen bg-[#0f172a]">
      <h1 className="text-3xl font-bold text-green-400 mb-6 text-center">
        🎞️ Your Projects
      </h1>

      {videos.length === 0 ? (
        <p className="text-center text-gray-400">No videos generated yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video, index) => (
            <div
              key={index}
              className="bg-[#1a1a1a] border border-gray-700 rounded-xl p-4 shadow-lg"
            >
              <video
                src={video.url}
                controls
                className="w-full h-48 object-cover rounded-lg mb-4"
              ></video>
              <p className="text-sm text-gray-300 truncate mb-2">
                📝 {video.topic || "Untitled"}
              </p>
              <div className="flex justify-between items-center text-sm text-gray-400">
                <span>🎵 {video.voice || "N/A"}</span>
                <span>🎬 {video.style || "N/A"}</span>
              </div>
              <div className="flex justify-between mt-4">
                <a
                  href={video.url}
                  download
                  className="bg-green-600 hover:bg-green-700 px-4 py-1 rounded text-sm"
                >
                  ⬇️ Download
                </a>
                <button
                  onClick={() => handleDelete(index)}
                  className="bg-red-600 hover:bg-red-700 px-4 py-1 rounded text-sm"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Projects;
