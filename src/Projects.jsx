import React, { useEffect, useState } from "react";
import axios from "axios";

function Projects() {
  const [videos, setVideos] = useState([]);

  const fetchVideos = async () => {
    try {
      const res = await axios.get("http://127.0.0.1:5000/videos");
      const sorted = res.data.sort((a, b) => b.date.localeCompare(a.date));
      setVideos(sorted);
    } catch (err) {
      console.error("❌ Failed to fetch videos", err);
    }
  };

  const handleDelete = async (filename) => {
    const ok = window.confirm(`Delete "${filename}"?`);
    if (!ok) return;

    try {
      await axios.delete(`http://127.0.0.1:5000/delete/${filename}`);
      fetchVideos(); // refresh
    } catch (err) {
      console.error("❌ Delete error", err);
      alert("Delete failed. Check console.");
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  return (
    <div className="p-6 text-white">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
        <span>📁</span> Your Projects
      </h1>

      {videos.length === 0 ? (
        <p className="text-gray-400">No videos yet. Generate one in the Generator tab.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((v, i) => {
            const title = decodeURIComponent(v.filename.replace(".mp4", "").replace(/_/g, " "));
            const videoUrl = `http://127.0.0.1:5000/${encodeURIComponent(v.filename)}`;

            return (
              <div
                key={i}
                className="bg-[#0f172a]/70 backdrop-blur border border-gray-700 rounded-2xl p-4 shadow-xl flex flex-col"
              >
                <video
                  src={videoUrl}
                  className="rounded w-full h-48 object-cover mb-3 border border-gray-600"
                  controls
                />
                <h2 className="text-lg font-semibold truncate">{title}</h2>
                <p className="text-sm text-gray-400 mb-3">Created: {v.date}</p>

                <div className="flex gap-2 mt-auto">
                  <a
                    href={videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 bg-purple-600 hover:bg-purple-700 px-3 py-2 text-center rounded text-sm font-bold"
                  >
                    👁 Watch
                  </a>
                  <a
                    href={videoUrl}
                    download
                    className="flex-1 bg-blue-600 hover:bg-blue-700 px-3 py-2 text-center rounded text-sm font-bold"
                  >
                    ⬇️ Download
                  </a>
                  <button
                    onClick={() => handleDelete(v.filename)}
                    className="flex-1 bg-red-600 hover:bg-red-700 px-3 py-2 text-sm rounded font-bold"
                  >
                    🗑 Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Projects;
